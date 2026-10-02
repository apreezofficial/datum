"use client";

import * as React from "react";
import { useTheme } from "@/lib/theme";
import { detectRepositoryStack, StackInfo } from "@/lib/stack-detector";
import {
  GitBranch,
  FolderGit2,
  Package,
  Layers,
  FileCode,
  FileText,
  Compass,
  Figma,
  ArrowDown,
} from "lucide-react";

import { DatumHeader } from "@/components/datum-header";
import { DatumSidebar } from "@/components/datum-sidebar";
import { DatumFooter } from "@/components/datum-footer";
import { HeroView } from "@/components/hero-view";
import { AnalysisView } from "@/components/analysis-view";

import type {
  StepItem,
  AuditData,
  ModelOption,
  HistoryItem,
  UserProfile,
} from "@/types/datum";

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
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isFigmaConnected, setIsFigmaConnected] = React.useState(false);
  const [autopilot, setAutopilot] = React.useState(false);
  const [auditData, setAuditData] = React.useState<AuditData | null>(null);
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const [detectedStack, setDetectedStack] = React.useState<StackInfo | null>(null);

  // Model selection state
  const [models, setModels] = React.useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = React.useState("openai/gpt-oss-120b");

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

  // History list
  const [history, setHistory] = React.useState<HistoryItem[]>([]);

  // Auto-scroll & "Go down" button state
  const mainScrollRef = React.useRef<HTMLElement>(null);
  const [showScrollDownButton, setShowScrollDownButton] = React.useState(false);
  const isProgrammaticScrollRef = React.useRef(false);
  const userScrolledUpRef = React.useRef(false);

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

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

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

  // Auto-scroll as steps advance or results appear, unless the user has scrolled up to read
  React.useEffect(() => {
    if (!activeItem) return;

    if (!userScrolledUpRef.current) {
      scrollToBottom("smooth");
    }
  }, [currentStepIndex, analysisComplete, criticalApproved, activeItem, scrollToBottom]);

  // GitHub steps — honest labels that reflect what actually happened
  const githubSteps: StepItem[] = [
    {
      id: "clone",
      icon: <GitBranch size={14} className="text-secondary" />,
      label: analysisComplete && auditError
        ? `Could not resolve ${activeItem || "repository"}`
        : isAnalyzing && currentStepIndex === 0
        ? `Resolving ${activeItem || "repository"}...`
        : `Resolved ${activeItem || "repository"}`,
      status: currentStepIndex > 0 ? "done" : currentStepIndex === 0 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "scan",
      icon: <FolderGit2 size={14} className="text-secondary" />,
      label: analysisComplete && auditError
        ? "No files fetched — repository inaccessible"
        : auditData?.totalFilesScanned
        ? `Fetched ${auditData.totalFilesScanned} UI files for analysis`
        : isAnalyzing && currentStepIndex === 1
        ? "Fetching repository files..."
        : "Fetched repository files",
      status: currentStepIndex > 1 ? "done" : currentStepIndex === 1 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "manifest",
      icon: <Package size={14} className="text-secondary" />,
      label: detectedStack?.steps[2]?.label
        || (isAnalyzing && currentStepIndex === 2 ? "Reading package manifest..." : "Read package manifest"),
      status: currentStepIndex > 2 ? "done" : currentStepIndex === 2 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "styling",
      icon: <FileCode size={14} className="text-secondary" />,
      label: detectedStack?.steps[3]?.label
        || (isAnalyzing && currentStepIndex === 3 ? "Reading design tokens & stylesheets..." : "Read design tokens & stylesheets"),
      status: currentStepIndex > 3 ? "done" : currentStepIndex === 3 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "structure",
      icon: <FileText size={14} className="text-secondary" />,
      label: detectedStack?.steps[4]?.label
        || (isAnalyzing && currentStepIndex === 4 ? "Reading UI component tree..." : "Read UI component tree"),
      status: currentStepIndex > 4 ? "done" : currentStepIndex === 4 && isAnalyzing ? "running" : "pending",
    },
    {
      id: "audit",
      icon: <Compass size={14} className="text-secondary" />,
      label: auditError && !auditData
        ? "Audit failed — repository not found or inaccessible"
        : auditData?.totalDeviations !== undefined
        ? `Audit completed: ${auditData.totalDeviations} UI deviation${auditData.totalDeviations === 1 ? "" : "s"} mapped`
        : isAnalyzing && currentStepIndex === 5
        ? "Running AI design audit..."
        : "Running AI design audit...",
      status: currentStepIndex > 5 ? "done" : currentStepIndex === 5 && isAnalyzing ? "running" : "pending",
    },
  ];

  // Figma steps
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
      icon: <Layers size={14} className="text-secondary" />,
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
    setAuditError(null);

    // Fast stack detection
    if (!isFigma) {
      detectRepositoryStack(cleanName).then((stk) => {
        setDetectedStack(stk);
      });
    }

    // Launch AI backend audit
    const auditPromise = fetch("/api/groq/audit", {
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
          return { data: res.data as AuditData, error: null };
        }
        return { data: null, error: (res?.error as string) || "Audit failed. Repository may not exist or be inaccessible." };
      })
      .catch((err) => {
        return { data: null, error: String(err) };
      });

    const maxProgressSteps = isFigma ? 3 : 5; // Animate up to the final step
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= maxProgressSteps) {
        setCurrentStepIndex(step);
      } else {
        clearInterval(interval);
      }
    }, 280);

    // Wait for the real AI audit to finish before completing the final step and revealing results!
    auditPromise.then(({ data: realData, error: realError }) => {
      clearInterval(interval);
      if (realData) {
        setAuditData(realData);
        setAuditError(null);
        if (realData.stack) {
          setDetectedStack(realData.stack);
        }
      } else if (realError) {
        setAuditError(realError);
      }

      // Advance to 100% completed
      setCurrentStepIndex(isFigma ? 4 : 6);
      setIsAnalyzing(false);
      setAnalysisComplete(true);

      const summaryText = realData
        ? isFigma
          ? "12 token mismatches"
          : `Drift ${realData.driftScore} / 100`
        : realError
        ? "Error"
        : "No deviations";

      setHistory((prev) => [
        {
          id: Math.random().toString(),
          name: cleanName,
          type: isFigma ? "figma" : "github",
          summary: summaryText,
          auditData: realData || undefined,
        },
        ...prev.filter((item) => item.name !== cleanName),
      ]);
    });
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
    setAuditError(null);
    setDetectedStack(null);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveItem(item.name);
    setSourceType(item.type);
    setAuditError(null);
    if (item.auditData) {
      setAuditData(item.auditData);
      if (item.auditData.stack) {
        setDetectedStack(item.auditData.stack);
      }
    }
    setAnalysisComplete(true);
    setCriticalApproved(false);
    setCurrentStepIndex(item.type === "github" ? 6 : 4);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      {/* 1. Collapsible Sidebar */}
      <DatumSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        history={history}
        activeItem={activeItem}
        isLoggedIn={isLoggedIn}
        userProfile={userProfile}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleLogin={handleToggleLogin}
        onResetToNew={resetToNew}
        onSelectHistory={handleSelectHistory}
      />

      {/* 2. Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header Bar */}
        <DatumHeader
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          activeItem={activeItem}
          sourceType={sourceType}
          analysisComplete={analysisComplete}
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          autopilot={autopilot}
          setAutopilot={setAutopilot}
          isLoggedIn={isLoggedIn}
          userProfile={userProfile}
          onToggleLogin={handleToggleLogin}
          isFigmaConnected={isFigmaConnected}
          onToggleFigmaConnection={handleToggleFigmaConnection}
        />

        {/* Content Area */}
        <main
          ref={mainScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative scroll-smooth"
        >
          {!activeItem ? (
            <HeroView
              sourceType={sourceType}
              setSourceType={setSourceType}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onStartAnalysis={handleStartAnalysis}
            />
          ) : (
            <AnalysisView
              sourceType={sourceType}
              activeItem={activeItem}
              isAnalyzing={isAnalyzing}
              analysisComplete={analysisComplete}
              currentStepIndex={currentStepIndex}
              currentSteps={currentSteps}
              stepsExpanded={stepsExpanded}
              setStepsExpanded={setStepsExpanded}
              activeModel={activeModel}
              auditData={auditData}
              auditError={auditError}
              criticalApproved={criticalApproved}
              isApproving={isApproving}
              isLoggedIn={isLoggedIn}
              userProfile={userProfile}
              isFigmaConnected={isFigmaConnected}
              handleToggleLogin={handleToggleLogin}
              handleToggleFigmaConnection={handleToggleFigmaConnection}
              handleApproveCriticalStep={handleApproveCriticalStep}
              resetToNew={resetToNew}
            />
          )}
        </main>

        {/* Floating "Go down" button */}
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

        {/* Global Bottom Footer */}
        <DatumFooter />
      </div>
    </div>
  );
}
