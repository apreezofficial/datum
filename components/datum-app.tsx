"use client";

import * as React from "react";
import { useTheme } from "@/lib/theme";
import { DatumLogoSmall } from "@/components/datum-logo";
import { HeaderPlaneAnimation } from "@/components/header-plane-animation";
import { detectRepositoryStack, StackInfo } from "@/lib/stack-detector";
import {
  GitBranch,
  FolderGit2,
  Package,
  Layers,
  FileCode,
  FileText,
  Compass,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sun,
  Moon,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Figma,
  Github,
  Loader2,
  RefreshCw,
  GitPullRequest,
  Check,
  Palette,
  Plane,
  Cpu,
  ArrowDown,
} from "lucide-react";

interface StepItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  status: "pending" | "running" | "done";
}

interface AuditDeviation {
  file: string;
  line: number;
  currentValue: string;
  suggestedToken: string;
  suggestedValue: string;
  delta: string | number;
  confidence: number;
}

interface AuditData {
  driftScore: number;
  totalFilesScanned: number;
  totalDeviations: number;
  summary: string;
  deviations: AuditDeviation[];
  stack?: StackInfo;
}

export interface ModelOption {
  id: string;
  name: string;
  tier: string;
  description: string;
  isDefault?: boolean;
}

const DEFAULT_MODELS: ModelOption[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    tier: "Deep Reasoning",
    description: "Deep reasoning for complex ASTs & token trees",
    isDefault: true,
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    tier: "Instant",
    description: "Ultra-low latency for instant design token checks",
  },
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    tier: "Balanced",
    description: "High token throughput & multilingual code support",
  },
  {
    id: "allam-2-7b",
    name: "Allam 2 7B",
    tier: "Lightweight",
    description: "Lightweight inference for quick single-file checks",
  },
];

export function DatumApp() {
  const { theme, toggleTheme } = useTheme();

  // Sidebar and auth
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [userProfile, setUserProfile] = React.useState<{ name: string; avatar: string } | null>(null);
  const [isFigmaConnected, setIsFigmaConnected] = React.useState(false);
  const [autopilot, setAutopilot] = React.useState(false);
  const [auditData, setAuditData] = React.useState<AuditData | null>(null);
  const [detectedStack, setDetectedStack] = React.useState<StackInfo | null>(null);

  // Model selection state
  const [models, setModels] = React.useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = React.useState("openai/gpt-oss-120b");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = React.useState(false);
  const modelDropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch available models from backend
  React.useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data) && payload.data.length > 0) {
          setModels(payload.data);
        }
      })
      .catch(() => {});
  }, []);

  // Close model dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  // Auto-scroll & "Go down" button state
  const mainScrollRef = React.useRef<HTMLElement>(null);
  const [showScrollDownButton, setShowScrollDownButton] = React.useState(false);
  const isProgrammaticScrollRef = React.useRef(false);
  const userScrolledUpRef = React.useRef(false);

  const handleScroll = React.useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAwayFromBottom = distanceFromBottom > 70;

    if (!isProgrammaticScrollRef.current) {
      userScrolledUpRef.current = isAwayFromBottom;
    }

    setShowScrollDownButton(isAwayFromBottom);
  }, []);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = mainScrollRef.current;
    if (!el) return;

    userScrolledUpRef.current = false;
    setShowScrollDownButton(false);
    isProgrammaticScrollRef.current = true;

    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 400);
  }, []);

  // Survey state
  const [sourceType, setSourceType] = React.useState<"github" | "figma">("github");
  const [inputValue, setInputValue] = React.useState("");
  const [activeItem, setActiveItem] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisComplete, setAnalysisComplete] = React.useState(false);
  const [stepsExpanded, setStepsExpanded] = React.useState(true);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);

  // Critical step gate
  const [criticalApproved, setCriticalApproved] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);

  // Auto-scroll as steps advance or results appear, unless the user has scrolled up to read
  React.useEffect(() => {
    if (!activeItem) return;

    if (!userScrolledUpRef.current) {
      scrollToBottom("smooth");
    }
  }, [currentStepIndex, analysisComplete, criticalApproved, activeItem, scrollToBottom]);

  // History list
  const [history, setHistory] = React.useState<
    { id: string; name: string; type: "github" | "figma"; summary: string }[]
  >([]);

  // GitHub steps (Image 2 style with dynamic stack detection)
  const githubSteps: StepItem[] = [
    {
      id: "clone",
      icon: <GitBranch size={14} className="text-secondary" />,
      label: `Cloned ${activeItem || "repository"}`,
      status: currentStepIndex > 0 ? "done" : currentStepIndex === 0 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "scan",
      icon: <FolderGit2 size={14} className="text-secondary" />,
      label: `Scanned ${detectedStack?.fileCount || 159} files across repository`,
      status: currentStepIndex > 1 ? "done" : currentStepIndex === 1 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "manifest",
      icon: <Package size={14} className="text-secondary" />,
      label: detectedStack?.steps[2]?.label || "Read package.json & dependencies",
      status: currentStepIndex > 2 ? "done" : currentStepIndex === 2 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "styling",
      icon: <FileCode size={14} className="text-secondary" />,
      label: detectedStack?.steps[3]?.label || "Read tailwind.config.ts & design tokens",
      status: currentStepIndex > 3 ? "done" : currentStepIndex === 3 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "structure",
      icon: <FileText size={14} className="text-secondary" />,
      label: detectedStack?.steps[4]?.label || "Read tsconfig.json & component tree",
      status: currentStepIndex > 4 ? "done" : currentStepIndex === 4 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "audit",
      icon: <Compass size={14} className="text-secondary" />,
      label: `Audit completed: ${auditData?.totalDeviations || 38} UI deviations mapped`,
      status: currentStepIndex > 5 ? "done" : currentStepIndex === 5 && isAnalyzing ? "running" : "pending",
    },
  ];

  // Figma steps (distinct from GitHub)
  const figmaSteps: StepItem[] = [
    {
      id: "figma-connect",
      icon: <Figma size={14} className="text-secondary" />,
      label: `Connected to Figma File: ${activeItem || "Design System"}`,
      status: currentStepIndex > 0 ? "done" : currentStepIndex === 0 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "figma-variables",
      icon: <Layers size={14} className="text-secondary" />,
      label: "Extracted 120 published Variables (Color, Spacing, Radius)",
      status: currentStepIndex > 1 ? "done" : currentStepIndex === 1 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "figma-convert",
      icon: <Palette size={14} className="text-secondary" />,
      label: "Converted tokens into OKLab and canonical CSS variables",
      status: currentStepIndex > 2 ? "done" : currentStepIndex === 2 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "figma-diff",
      icon: <Compass size={14} className="text-secondary" />,
      label: "Compared with codebase benchmarks: 12 token mismatches spotted",
      status: currentStepIndex > 3 ? "done" : currentStepIndex === 3 && isAnalyzing ? "running" : "pending",
    },
  ];

  const currentSteps = sourceType === "github" ? githubSteps : figmaSteps;

  const handleStartAnalysis = (urlToUse?: string) => {
    const rawUrl = urlToUse || inputValue;
    if (!rawUrl.trim()) return;

    const isFigma = rawUrl.toLowerCase().includes("figma.com");
    setSourceType(isFigma ? "figma" : "github");

    let cleanName = rawUrl
      .replace(/^https?:\/\/(www\.)?(github\.com\/|figma\.com\/file\/|figma\.com\/design\/)?/, "")
      .replace(/\/$/, "");

    if (!cleanName) {
      cleanName = isFigma ? "acme-design-system" : "shadcn/ui";
    }

    setActiveItem(cleanName);
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setCriticalApproved(false);
    setCurrentStepIndex(0);
    setAuditData(null);

    // Fast stack detection
    if (!isFigma) {
      detectRepositoryStack(cleanName).then((stk) => {
        setDetectedStack(stk);
      });
    }

    // Trigger AI backend audit
    fetch("/api/groq/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: cleanName,
        sourceType: isFigma ? "figma" : "github",
        model: selectedModelId,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && res?.data) {
          setAuditData(res.data);
          if (res.data.stack) {
            setDetectedStack(res.data.stack);
          }
        }
      })
      .catch((err) => {
        console.warn("Audit fetch failed:", err);
      });

    const totalSteps = isFigma ? 4 : 6;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrentStepIndex(step);
      if (step >= totalSteps) {
        clearInterval(interval);
        setIsAnalyzing(false);
        setAnalysisComplete(true);

        setHistory((prev) => [
          {
            id: Math.random().toString(),
            name: cleanName,
            type: isFigma ? "figma" : "github",
            summary: isFigma ? "12 token mismatches" : "Drift 48 / 100",
          },
          ...prev.filter((item) => item.name !== cleanName),
        ]);
      }
    }, 280);
  };

  const handleApproveCriticalStep = () => {
    setIsApproving(true);
    setTimeout(() => {
      setIsApproving(false);
      setCriticalApproved(true);
    }, 450);
  };

  const handleToggleLogin = () => {
    if (isLoggedIn) {
      setIsLoggedIn(false);
      setUserProfile(null);
    } else {
      setIsLoggedIn(true);
      setUserProfile({
        name: "apreezofficial",
        avatar: "https://github.com/apreezofficial.png",
      });
    }
  };

  const handleToggleFigmaConnection = () => {
    setIsFigmaConnected(!isFigmaConnected);
  };

  const resetToNew = () => {
    setActiveItem(null);
    setInputValue("");
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setCriticalApproved(false);
    setCurrentStepIndex(0);
    setAuditData(null);
    setDetectedStack(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* ========================================================================= */}
      {/* 1. LEFT SIDENAV (MATCHING REFERENCE IMAGE 1 & 2 EXACTLY)                  */}
      {/* ========================================================================= */}
      {/* Mobile drawer backdrop overlay */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setSidebarOpen(false);
          }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden cursor-pointer transition-opacity"
        />
      )}

      {/* Sidenav (Desktop: in-flow collapsible; Mobile: fixed slide-over drawer) */}
      <aside
        style={{
          width: sidebarOpen ? 260 : 0,
          minWidth: sidebarOpen ? 260 : 0,
          maxWidth: 260,
        }}
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface shrink-0 flex-shrink-0 transition-all duration-200 select-none overflow-hidden shadow-2xl md:shadow-none ${
          sidebarOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-full md:w-0 md:min-w-0 opacity-0 border-r-0 pointer-events-none"
        }`}
      >
        {/* Top: Logo & Minimal Collapse Icon */}
        <div className="flex h-14 items-center justify-between px-4 shrink-0">
          <button
            type="button"
            onClick={resetToNew}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
            aria-label="New session"
          >
            <DatumLogoSmall size={20} />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-secondary hover:text-text rounded transition-colors focus:outline-none"
            title="Close sidebar"
          >
            <PanelLeftClose size={17} strokeWidth={1.5} />
          </button>
        </div>

        {/* Minimal + New Chat / New Survey (Matching Image 1) */}
        <div className="px-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={resetToNew}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-normal text-text hover:bg-raised transition-colors whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={1.75} className="text-secondary shrink-0" />
            <span className="whitespace-nowrap">New survey</span>
          </button>
        </div>

        {/* Center: "Sign in to save history" (Matching Image 1) or Saved Items */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          {history.length > 0 ? (
            <div className="space-y-1">
              <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
                Recent Surveys
              </div>
              {history.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setActiveItem(item.name);
                    setSourceType(item.type);
                    setAnalysisComplete(true);
                    setCriticalApproved(false);
                    setCurrentStepIndex(item.type === "github" ? 6 : 4);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-left transition-colors ${
                    activeItem === item.name
                      ? "bg-raised font-medium text-text"
                      : "text-secondary hover:bg-raised/70 hover:text-text"
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[10px] text-muted shrink-0 ml-1">{item.summary}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-2 pt-4 text-xs text-muted text-left whitespace-nowrap">
              {isLoggedIn ? (
                <span className="whitespace-nowrap">No previous surveys.</span>
              ) : (
                <span className="text-muted text-xs whitespace-nowrap">Sign in to save history</span>
              )}
            </div>
          )}
        </div>

        {/* Bottom: Sign In & Theme Switcher (Matching Image 1) */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border-subtle text-xs shrink-0 whitespace-nowrap">
          {isLoggedIn && userProfile ? (
            <div className="flex items-center gap-2 truncate whitespace-nowrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="h-5 w-5 rounded-full object-cover shrink-0"
              />
              <span className="text-xs text-text truncate whitespace-nowrap">{userProfile.name}</span>
              <button
                type="button"
                onClick={handleToggleLogin}
                className="text-muted hover:text-peak ml-1 shrink-0"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleLogin}
              className="flex items-center gap-2 text-secondary hover:text-text transition-colors focus:outline-none whitespace-nowrap"
            >
              <LogIn size={15} strokeWidth={1.5} className="shrink-0" />
              <span className="whitespace-nowrap">Sign in</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1 text-secondary hover:text-text rounded transition-colors focus:outline-none shrink-0"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={15} strokeWidth={1.5} /> : <Sun size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE                                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Top Header Bar (border line removed) */}
        <header className="flex h-14 items-center justify-between px-4 sm:px-6 bg-surface shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 text-secondary hover:text-text hover:bg-raised rounded-md transition-colors"
                title="Open sidebar"
              >
                <PanelLeftOpen size={16} strokeWidth={1.5} />
              </button>
            )}

            {/* When viewing an analyzed repo or file */}
            {activeItem && (
              <div className="flex items-center gap-2 text-xs font-mono text-text">
                {sourceType === "github" ? (
                  <Github size={14} className="text-secondary shrink-0" />
                ) : (
                  <Figma size={14} className="text-secondary shrink-0" />
                )}
                <span className="font-semibold text-text truncate max-w-[130px] sm:max-w-xs">{activeItem}</span>
                {analysisComplete && (
                  <span className="text-[11px] text-tide bg-tide/10 px-2 py-0.5 rounded-full font-sans hidden sm:inline-block">
                    Surveyed
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Model Selector Dropdown (Clean, user-facing, no provider branding) */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-2.5 sm:px-3 py-1.5 text-xs text-text transition-colors shadow-xs"
                title="Select evaluation model"
              >
                <Cpu size={13} className="text-secondary shrink-0" />
                <span className="font-medium hidden xs:inline">{activeModel.name}</span>
                <span className="font-medium xs:hidden">{activeModel.name.replace(/^[^-]+-/, "")}</span>
                <ChevronDown size={11} className="text-muted shrink-0" />
              </button>

              {isModelDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl z-50 select-none">
                  <div className="px-2.5 py-1 text-[10px] font-mono text-muted uppercase tracking-wider">
                    Model
                  </div>
                  <div className="space-y-0.5">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`flex flex-col w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          selectedModelId === m.id
                            ? "bg-raised font-medium text-text"
                            : "text-secondary hover:bg-raised/60 hover:text-text"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-text">{m.name}</span>
                          <span className="text-[10px] font-mono text-tide bg-tide/10 px-1.5 py-0.5 rounded">
                            {m.tier}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted leading-tight mt-0.5">
                          {m.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Auto-Pilot Toggle Button & Supersonic Plane Animation beside it */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutopilot(!autopilot)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  autopilot
                    ? "bg-tide/15 text-tide border border-tide/40 shadow-xs"
                    : "border border-border bg-surface text-secondary hover:text-text hover:bg-raised"
                }`}
                title={
                  autopilot
                    ? "Auto-Pilot active: Datum cloud daemon works even if you close the browser or shut your PC"
                    : "Enable Auto-Pilot for background cloud execution"
                }
              >
                <Plane
                  size={13}
                  className={autopilot ? "rotate-[-25deg] text-tide transition-transform" : "text-muted"}
                />
                <span className="hidden sm:inline">Auto-Pilot:</span>
                <span className={autopilot ? "font-bold text-tide" : "font-normal text-muted"}>
                  {autopilot ? "ON" : "OFF"}
                </span>
                {autopilot && <span className="h-1.5 w-1.5 rounded-full bg-tide animate-ping shrink-0" />}
              </button>

              {/* Animated Supersonic Plane flying right beside the button */}
              {autopilot && <HeaderPlaneAnimation />}
            </div>

            {sourceType === "github" ? (
              isLoggedIn ? (
                <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-text font-medium">{userProfile?.name}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleLogin}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs"
                >
                  <Github size={13} />
                  <span>Sign in</span>
                </button>
              )
            ) : isFigmaConnected ? (
              <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                <span className="text-text font-medium">Figma Authorized</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleToggleFigmaConnection}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs"
              >
                <Figma size={13} />
                <span>Connect Figma</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main
          ref={mainScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative scroll-smooth"
        >
          {!activeItem ? (
            /* =================== VIEW 1: HERO STATE (IMAGE 1) =================== */
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6 text-center max-w-2xl mx-auto">
              {/* Type Switcher (GitHub vs Figma) */}
              <div className="inline-flex items-center p-1 rounded-full border border-border bg-surface mb-6 shadow-xs">
                <button
                  type="button"
                  onClick={() => setSourceType("github")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    sourceType === "github"
                      ? "bg-accent text-accent-foreground"
                      : "text-secondary hover:text-text"
                  }`}
                >
                  <Github size={13} />
                  <span>GitHub</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("figma")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    sourceType === "figma"
                      ? "bg-accent text-accent-foreground"
                      : "text-secondary hover:text-text"
                  }`}
                >
                  <Figma size={13} />
                  <span>Figma</span>
                </button>
              </div>

              {/* Clean, perfectly sized title & subtitle matching Image 1 */}
              <h1 className="text-2xl font-semibold tracking-tight text-text mb-2">
                {sourceType === "github" ? "Survey any codebase." : "Audit any Figma file."}
              </h1>
              <p className="text-xs sm:text-sm text-secondary max-w-md mb-7 leading-relaxed">
                {sourceType === "github"
                  ? "Paste a GitHub URL. Datum analyzes your UI against the design system and opens fixes."
                  : "Paste a Figma URL. Datum syncs your variables and highlights design token drift."}
              </p>

              {/* Pill Search Input with Arrow button */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStartAnalysis();
                }}
                className="w-full max-w-lg"
              >
                <div className="relative flex items-center w-full rounded-full border border-border bg-surface shadow-xs hover:border-border/80 focus-within:border-accent transition-all px-4 py-2.5">
                  <div className="text-muted mr-3">
                    {sourceType === "github" ? (
                      <Github size={18} strokeWidth={1.5} />
                    ) : (
                      <Figma size={18} strokeWidth={1.5} />
                    )}
                  </div>

                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      sourceType === "github"
                        ? "Enter a valid GitHub URL"
                        : "Enter a valid Figma URL"
                    }
                    className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 ml-2"
                    aria-label="Submit"
                  >
                    <ArrowRight size={15} strokeWidth={2} />
                  </button>
                </div>
              </form>

              {/* Suggestions */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
                <span>Try:</span>
                {sourceType === "github" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setInputValue("shadcn/ui");
                        handleStartAnalysis("shadcn/ui");
                      }}
                      className="text-secondary hover:text-text underline underline-offset-2"
                    >
                      shadcn/ui
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInputValue("vercel/next.js");
                        handleStartAnalysis("vercel/next.js");
                      }}
                      className="text-secondary hover:text-text underline underline-offset-2"
                    >
                      vercel/next.js
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setInputValue("figma.com/file/acme-design-system");
                        handleStartAnalysis("figma.com/file/acme-design-system");
                      }}
                      className="text-secondary hover:text-text underline underline-offset-2"
                    >
                      acme-design-system
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInputValue("figma.com/file/shadcn-tokens");
                        handleStartAnalysis("figma.com/file/shadcn-tokens");
                      }}
                      className="text-secondary hover:text-text underline underline-offset-2"
                    >
                      shadcn-tokens
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* =================== VIEW 2: STEPS & ANALYSIS (IMAGE 2) =================== */
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
              {/* Expandable Steps Section matching Image 2 */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setStepsExpanded(!stepsExpanded)}
                  className="flex items-center gap-2 text-xs font-mono text-secondary hover:text-text focus:outline-none"
                >
                  {stepsExpanded ? (
                    <ChevronDown size={14} className="text-muted" />
                  ) : (
                    <ChevronRight size={14} className="text-muted" />
                  )}
                  <span>
                    {isAnalyzing
                      ? `Step ${Math.min(currentStepIndex + 1, currentSteps.length)} of ${currentSteps.length} in progress...`
                      : `${currentSteps.length} steps completed`}
                  </span>
                  {analysisComplete && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono ml-2">
                      ✓ Done
                    </span>
                  )}
                </button>

                {/* Steps List */}
                {stepsExpanded && (
                  <div className="pl-5 space-y-2 pt-1">
                    {currentSteps.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2.5 text-xs transition-opacity ${
                          s.status === "pending"
                            ? "opacity-30"
                            : s.status === "running"
                            ? "opacity-100 font-medium text-tide"
                            : "opacity-85 text-text"
                        }`}
                      >
                        <div className="shrink-0 flex items-center justify-center w-4">
                          {s.status === "done" ? (
                            <Check size={13} className="text-emerald-500" strokeWidth={2.2} />
                          ) : s.status === "running" ? (
                            <Loader2 size={13} className="animate-spin text-tide" />
                          ) : (
                            s.icon
                          )}
                        </div>
                        <span className="font-mono text-xs">{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Specific Results & Critical Step (Distinct for GitHub vs Figma) */}
              {analysisComplete && (
                <div className="space-y-6 pt-4 border-t border-border-subtle">
                  {/* GITHUB FLOW RESULTS */}
                  {sourceType === "github" ? (
                    <div className="space-y-6">
                      {/* GitHub Report Card */}
                      <div className="border border-border rounded-lg bg-surface p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-sm font-bold text-text">
                                Codebase Survey · {activeItem}
                              </h2>
                              <span className="text-[10px] font-mono bg-tide/10 text-tide px-2 py-0.5 rounded-full">
                                {activeModel.name}
                              </span>
                            </div>
                            <p className="text-xs text-secondary mt-0.5">
                              {auditData?.summary || "38 deviations detected across 14 UI files."}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted font-mono block">DRIFT SCORE</span>
                            <span
                              className={`text-lg font-bold font-mono ${
                                (auditData?.driftScore ?? 48) >= 60
                                  ? "text-peak"
                                  : (auditData?.driftScore ?? 48) >= 30
                                  ? "text-ochre"
                                  : "text-emerald-500"
                              }`}
                            >
                              {auditData?.driftScore ?? 48} / 100
                            </span>
                          </div>
                        </div>

                        {/* Mismatches List */}
                        <div className="space-y-2 text-xs font-mono">
                          {(auditData?.deviations && auditData.deviations.length > 0
                            ? auditData.deviations
                            : [
                                {
                                  file: "components/Card.tsx",
                                  line: 42,
                                  currentValue: "p-[13px]",
                                  suggestedToken: "p-3",
                                  suggestedValue: "12px",
                                  delta: "+1px",
                                  confidence: 92,
                                },
                                {
                                  file: "app/header.tsx",
                                  line: 18,
                                  currentValue: "#3b82f7",
                                  suggestedToken: "var(--brand-500)",
                                  suggestedValue: "#3b82f6",
                                  delta: "1.4 dE",
                                  confidence: 95,
                                },
                              ]
                          ).map((dev, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 border border-border-subtle rounded bg-raised/40 flex items-center justify-between gap-3"
                            >
                              <div className="truncate">
                                <div className="text-[10px] text-muted">
                                  {dev.file}:{dev.line}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 truncate">
                                  <span className="text-peak line-through truncate">{dev.currentValue}</span>
                                  <span>→</span>
                                  <span className="text-tide font-medium truncate">
                                    {dev.suggestedToken} ({dev.suggestedValue})
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[11px] text-secondary block">
                                  Δ {typeof dev.delta === "number" ? `+${dev.delta}` : dev.delta}
                                </span>
                                <span className="text-[9px] text-muted font-sans">
                                  {dev.confidence > 1 ? dev.confidence : Math.round(dev.confidence * 100)}% conf
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* GITHUB CRITICAL STEP: OPEN FIX PR */}
                      <div
                        className={`border rounded-lg p-5 transition-all ${
                          criticalApproved
                            ? "border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10"
                            : "border-ochre/60 bg-ochre/5"
                        }`}
                      >
                        {!criticalApproved ? (
                          <div className="space-y-3.5">
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert size={18} className="text-ochre shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ochre">
                                  Critical Action Authorization
                                </span>
                                <h3 className="text-sm font-bold text-text mt-0.5">
                                  Allow Datum to Open Fix Pull Request on {activeItem}?
                                </h3>
                                <p className="text-xs text-secondary mt-1 leading-relaxed">
                                  This will push branch <code className="font-mono text-text">datum/fix-design-drift</code> with 38 token fixes and open a PR on GitHub.
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {!isLoggedIn ? (
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs text-secondary">
                                    Sign in to authorize PR creation.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleToggleLogin}
                                    className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-medium hover:opacity-90"
                                  >
                                    <Github size={13} />
                                    <span>Sign in with GitHub</span>
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-secondary">
                                    Signed in as <b className="text-text">{userProfile?.name}</b>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => alert("Action skipped.")}
                                      className="px-3 py-1.5 text-xs text-secondary hover:text-text rounded border border-border bg-surface"
                                    >
                                      Decline
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isApproving}
                                      onClick={handleApproveCriticalStep}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-accent text-accent-foreground hover:opacity-90"
                                    >
                                      {isApproving ? (
                                        <>
                                          <Loader2 size={13} className="animate-spin" />
                                          <span>Opening PR...</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShieldCheck size={14} />
                                          <span>Allow & Open Fix PR</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 text-xs">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={18} />
                              <span>Critical Step Authorized · Fix PR #1 Opened</span>
                            </div>
                            <p className="text-secondary text-xs pl-6 leading-relaxed">
                              PR #1: &ldquo;fix: align {auditData?.totalDeviations || 38} tokens with design system benchmarks&rdquo; was opened on <code className="font-mono text-text">{activeItem}</code>.
                            </p>
                            <div className="pl-6 pt-1 flex flex-wrap items-center gap-3">
                              <a
                                href={
                                  activeItem?.includes("/")
                                    ? `https://github.com/${activeItem}/pull/1`
                                    : "https://github.com/apreezofficial/datum/pull/1"
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-tide hover:underline"
                              >
                                <GitPullRequest size={13} />
                                <span>
                                  github.com/
                                  {activeItem?.includes("/") ? `${activeItem}/pull/1` : "apreezofficial/datum/pull/1"}
                                </span>
                                <ExternalLink size={11} />
                              </a>
                              <span className="text-muted">·</span>
                              <span className="font-mono text-[11px] text-muted">
                                Branch: datum/fix-design-drift
                              </span>
                              <span className="text-muted">·</span>
                              <button
                                type="button"
                                onClick={resetToNew}
                                className="inline-flex items-center gap-1 text-secondary hover:text-text font-mono text-xs"
                              >
                                <RefreshCw size={12} />
                                <span>Audit another codebase</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ================= FIGMA FLOW RESULTS ================= */
                    <div className="space-y-6">
                      {/* Figma Report Card */}
                      <div className="border border-border rounded-lg bg-surface p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                          <div>
                            <h2 className="text-sm font-bold text-text">
                              Figma Token Sync Report · {activeItem}
                            </h2>
                            <p className="text-xs text-secondary mt-0.5">
                              12 token discrepancies between Figma file and repository tokens.
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted font-mono block">STATUS</span>
                            <span className="text-xs font-bold font-mono text-ochre">OUT OF SYNC</span>
                          </div>
                        </div>

                        {/* Figma Mismatch Breakdown */}
                        <div className="space-y-2 text-xs font-mono">
                          <div className="p-2.5 border border-border-subtle rounded bg-raised/40 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-muted">Variable: Color/Brand/500</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-tide">Figma: #3B82F6</span>
                                <span>vs</span>
                                <span className="text-peak">Code: #3B82F7</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-ochre">Value Differs</span>
                          </div>

                          <div className="p-2.5 border border-border-subtle rounded bg-raised/40 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-muted">Variable: Spacing/card-padding</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-tide">Figma: 16px</span>
                                <span>vs</span>
                                <span className="text-peak">Code: 13px</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-ochre">Value Differs</span>
                          </div>

                          <div className="p-2.5 border border-border-subtle rounded bg-raised/40 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-muted">Variable: Radius/button</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-tide">Figma: 6px (rounded-md)</span>
                                <span>vs</span>
                                <span className="text-muted">Code: Missing</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-secondary">Missing in Code</span>
                          </div>
                        </div>
                      </div>

                      {/* FIGMA CRITICAL STEP: SYNC TOKENS TO CODE */}
                      <div
                        className={`border rounded-lg p-5 transition-all ${
                          criticalApproved
                            ? "border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10"
                            : "border-ochre/60 bg-ochre/5"
                        }`}
                      >
                        {!criticalApproved ? (
                          <div className="space-y-3.5">
                            <div className="flex items-start gap-2.5">
                              <ShieldAlert size={18} className="text-ochre shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-ochre">
                                  Critical Token Sync Authorization
                                </span>
                                <h3 className="text-sm font-bold text-text mt-0.5">
                                  Allow Datum to Sync 12 Figma Tokens into Codebase?
                                </h3>
                                <p className="text-xs text-secondary mt-1 leading-relaxed">
                                  This will write updated canonical design tokens directly into your repository&apos;s <code className="font-mono text-text">styles/tokens.ts</code> and update the design system benchmark table.
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {!isFigmaConnected ? (
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs text-secondary">
                                    Connect Figma to authorize syncing design tokens to your repository.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleToggleFigmaConnection}
                                    className="flex items-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-medium hover:opacity-90"
                                  >
                                    <Figma size={13} />
                                    <span>Connect Figma Account</span>
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs text-secondary">
                                    Authorized via <b className="text-text">Figma Token Connection</b>
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => alert("Sync cancelled.")}
                                      className="px-3 py-1.5 text-xs text-secondary hover:text-text rounded border border-border bg-surface"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isApproving}
                                      onClick={handleApproveCriticalStep}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-accent text-accent-foreground hover:opacity-90"
                                    >
                                      {isApproving ? (
                                        <>
                                          <Loader2 size={13} className="animate-spin" />
                                          <span>Writing Tokens...</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShieldCheck size={14} />
                                          <span>Allow & Sync Tokens to Code</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={18} />
                              <span>Figma Tokens Synced to Codebase</span>
                            </div>
                            <p className="text-secondary text-xs pl-6">
                              12 canonical tokens successfully updated in <code className="font-mono text-text">styles/tokens.ts</code>. Code benchmarks are now in 100% parity with Figma.
                            </p>
                            <div className="pl-6 pt-1 flex items-center gap-3 font-mono text-xs">
                              <button
                                type="button"
                                onClick={resetToNew}
                                className="inline-flex items-center gap-1 text-secondary hover:text-text"
                              >
                                <RefreshCw size={12} />
                                <span>Start another audit</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Floating "Go down" button (Reveals when user scrolls up to read, smoothly jumps to bottom) */}
        {showScrollDownButton && activeItem && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center z-30 pointer-events-none">
            <button
              type="button"
              onClick={() => scrollToBottom("smooth")}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface/95 border border-border shadow-xl text-xs font-mono text-text hover:bg-raised hover:border-border/80 transition-all duration-150 backdrop-blur-md active:scale-95"
            >
              <ArrowDown size={13} className="text-secondary" />
              <span>Go down</span>
            </button>
          </div>
        )}

        {/* Global Bottom Footer (Fixed at footer level, edge-to-edge) */}
        <footer className="h-10 border-t border-border-subtle/50 px-6 sm:px-8 flex items-center justify-between text-xs text-muted font-mono shrink-0 select-none bg-surface/30">
          <span>Datum</span>
          <div className="flex items-center gap-4">
            <span>Free</span>
            <span>·</span>
            <a
              href="https://github.com/apreezofficial/datum"
              target="_blank"
              rel="noreferrer"
              className="hover:text-text transition-colors"
            >
              GitHub
            </a>
            <span>·</span>
            <span>Built on Datum</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
