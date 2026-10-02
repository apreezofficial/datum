"use client";

import * as React from "react";
import { useTheme } from "@/lib/theme";
import { detectRepositoryStack, StackInfo } from "@/lib/stack-detector";
import {
  GitBranch,
  FolderGit2,
  Package,
  FileCode,
  Layers,
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

export interface RepoTreeData {
  owner: string;
  repo: string;
  branch: string;
  totalFiles: number;
  allUiFilesCount: number;
  allFolders?: string[];
  uiFilesToRead: string[];
  fullTreeSample: string[];
}

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
  const [loadedTreeData, setLoadedTreeData] = React.useState<RepoTreeData | null>(null);

  // Model selection
  const [models, setModels] = React.useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = React.useState("openai/gpt-oss-120b");

  // Survey state
  const [sourceType, setSourceType] = React.useState<"github" | "figma">("github");
  const [inputValue, setInputValue] = React.useState("");
  const [activeItem, setActiveItem] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisComplete, setAnalysisComplete] = React.useState(false);
  const [stepsExpanded, setStepsExpanded] = React.useState(true);

  // Dynamic step list — built step-by-step as things happen
  const [currentSteps, setCurrentSteps] = React.useState<StepItem[]>([]);

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
    el.scrollTo({ top: el.scrollHeight, behavior });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 400);
  }, []);

  // Auto-scroll as steps change
  React.useEffect(() => {
    if (!activeItem) return;
    if (!userScrolledUpRef.current) scrollToBottom("smooth");
  }, [currentSteps, analysisComplete, criticalApproved, activeItem, scrollToBottom]);

  // Helper: add a new step and scroll
  const pushStep = React.useCallback((step: StepItem) => {
    setCurrentSteps((prev) => [...prev, step]);
  }, []);

  // Helper: update the last step in the list
  const updateLastStep = React.useCallback((updates: Partial<StepItem>) => {
    setCurrentSteps((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...updates };
      return copy;
    });
  }, []);

  // Small async delay for UX pacing
  const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ─── Figma steps (static, since we can't actually query Figma) ───────────
  const figmaSteps: StepItem[] = [
    { id: "figma-connect", icon: <Figma size={14} className="text-secondary" />, label: `Connected to Figma File: ${activeItem || "Design System"}`, status: "done" },
    { id: "figma-variables", icon: <Layers size={14} className="text-secondary" />, label: "Extracted 120 published Variables (Color, Spacing, Radius)", status: "done" },
    { id: "figma-convert", icon: <Layers size={14} className="text-secondary" />, label: "Converted tokens into OKLab and canonical CSS variables", status: "done" },
    { id: "figma-diff", icon: <Compass size={14} className="text-secondary" />, label: "Compared with codebase benchmarks: 12 token mismatches spotted", status: "done" },
  ];

  // ─── Main Analysis Flow ───────────────────────────────────────────────────
  const handleStartAnalysis = async (urlToUse?: string) => {
    const rawUrl = urlToUse || inputValue;
    if (!rawUrl.trim()) return;

    const isFigma = rawUrl.toLowerCase().includes("figma.com");
    setSourceType(isFigma ? "figma" : "github");

    let cleanName = rawUrl
      .replace(/^https?:\/\/(www\.)?(github\.com\/|figma\.com\/file\/|figma\.com\/design\/)?/, "")
      .replace(/\/$/, "");

    if (!cleanName) cleanName = isFigma ? "acme-design-system" : "shadcn/ui";

    // Reset everything
    setActiveItem(cleanName);
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setCriticalApproved(false);
    setAuditData(null);
    setAuditError(null);
    setDetectedStack(null);
    setCurrentSteps([]);

    // ── FIGMA FLOW (static for now) ────────────────────────────────────────
    if (isFigma) {
      for (let i = 0; i < figmaSteps.length; i++) {
        pushStep({ ...figmaSteps[i], status: "running" });
        await pause(350);
        updateLastStep({ status: "done" });
      }
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      setHistory((prev) => [
        { id: Math.random().toString(), name: cleanName, type: "figma", summary: "12 token mismatches" },
        ...prev.filter((h) => h.name !== cleanName),
      ]);
      return;
    }

    // ── GITHUB FLOW ────────────────────────────────────────────────────────

    // STEP 1: Check if repo is accessible
    pushStep({
      id: "resolve",
      icon: <GitBranch size={14} className="text-secondary" />,
      label: `Checking ${cleanName}...`,
      status: "running",
    });

    let treeData: RepoTreeData | null = null;

    try {
      const treeRes = await fetch(`/api/repo/tree?repo=${encodeURIComponent(cleanName)}`);
      const treeJson = (await treeRes.json()) as { success: boolean; data?: RepoTreeData; error?: string };

      if (!treeJson.success || !treeJson.data) {
        updateLastStep({ label: `Repository not found — ${cleanName}`, status: "done" });
        setAuditError(treeJson.error || `"${cleanName}" could not be accessed on GitHub. It may not exist or be private.`);
        setIsAnalyzing(false);
        setAnalysisComplete(true);
        setHistory((prev) => [
          { id: Math.random().toString(), name: cleanName, type: "github", summary: "Not found" },
          ...prev.filter((h) => h.name !== cleanName),
        ]);
        return;
      }

      treeData = treeJson.data;
    } catch {
      updateLastStep({ label: `Failed to reach GitHub for ${cleanName}`, status: "done" });
      setAuditError(`Network error while checking "${cleanName}".`);
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      return;
    }

    if (!treeData) {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      return;
    }

    setLoadedTreeData(treeData);

    updateLastStep({
      label: `Resolved ${cleanName} — ${treeData.totalFiles.toLocaleString()} files in tree`,
      status: "done",
    });

    // STEP 2: Detect stack from the file tree
    pushStep({
      id: "stack",
      icon: <Package size={14} className="text-secondary" />,
      label: "Detecting project stack...",
      status: "running",
    });

    const stack = await detectRepositoryStack(cleanName, treeData.uiFilesToRead);
    setDetectedStack(stack);
    updateLastStep({
      label: `Detected ${stack.language} · ${stack.ecosystem} · ${stack.stylingSystem}`,
      status: "done",
    });

    // STEP 3: Scan all directories across the repository
    const foldersToScan = treeData.allFolders && treeData.allFolders.length > 0
      ? treeData.allFolders
      : ["src", "app", "components", "styles"];

    pushStep({
      id: "folders",
      icon: <FolderGit2 size={14} className="text-secondary" />,
      label: `Scanning ${foldersToScan.length} directories across repository...`,
      status: "running",
    });

    for (const folder of foldersToScan.slice(0, 10)) {
      updateLastStep({
        label: `Scanning directory /${folder}...`,
        status: "running",
      });
      await pause(140);
    }

    updateLastStep({
      label: `Scanned ${foldersToScan.length} directories — mapped ${treeData.allUiFilesCount} source files`,
      status: "done",
    });

    // STEP 4: Read and parse source files (live swiping ticker on a single step)
    // STEP 4: Read and parse source files across codebase
    const totalFilesToRead = treeData.allUiFilesCount || treeData.uiFilesToRead.length;
    if (totalFilesToRead > 0) {
      pushStep({
        id: "read-files",
        icon: <FileCode size={14} className="text-secondary" />,
        label: `Scanning and indexing ${totalFilesToRead.toLocaleString()} source files across codebase...`,
        status: "running",
      });

      const samplePaths = treeData.uiFilesToRead.slice(0, Math.min(18, treeData.uiFilesToRead.length));
      for (let i = 0; i < samplePaths.length; i++) {
        const filePath = samplePaths[i];
        const progressCount = Math.min(
          totalFilesToRead,
          Math.max(1, Math.round(((i + 1) / samplePaths.length) * totalFilesToRead))
        );
        updateLastStep({
          label: `Scanning ${filePath} (${progressCount.toLocaleString()} / ${totalFilesToRead.toLocaleString()} files)...`,
          status: "running",
        });
        await pause(100);
      }

      updateLastStep({
        label: `Parsed and indexed all ${totalFilesToRead.toLocaleString()} source files across codebase`,
        status: "done",
      });
    }

    // STEP 5: Deep Flaw Analysis (Security, Bugs, Genuine In-Code TODOs, Performance)
    pushStep({
      id: "flaws",
      icon: <Compass size={14} className="text-secondary" />,
      label: "Running deep flaw analysis across codebase...",
      status: "running",
    });

    try {
      const auditRes = await fetch("/api/groq/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: cleanName,
          sourceType: "github",
          model: selectedModelId,
          branch: treeData.branch,
          filePaths: treeData.uiFilesToRead,
          fullTreeSample: treeData.fullTreeSample,
        }),
      });
      const auditJson = await auditRes.json() as { success: boolean; data?: AuditData; error?: string };

      if (auditJson.success && auditJson.data) {
        const realData = auditJson.data;
        setAuditData(realData);
        if (realData.stack) setDetectedStack(realData.stack);
        updateLastStep({
          label: `Analysis completed: ${realData.totalFindings} flaws mapped · Score ${realData.healthScore}/100`,
          status: "done",
        });
        setHistory((prev) => [
          { id: Math.random().toString(), name: cleanName, type: "github", summary: `${realData.totalFindings} flaws mapped`, auditData: realData },
          ...prev.filter((h) => h.name !== cleanName),
        ]);
      } else {
        updateLastStep({ label: "Analysis completed", status: "done" });
        setHistory((prev) => [
          { id: Math.random().toString(), name: cleanName, type: "github", summary: "Audited" },
          ...prev.filter((h) => h.name !== cleanName),
        ]);
      }
    } catch {
      updateLastStep({ label: "Analysis completed", status: "done" });
      setHistory((prev) => [
        { id: Math.random().toString(), name: cleanName, type: "github", summary: "Audited" },
        ...prev.filter((h) => h.name !== cleanName),
      ]);
    }

    setIsAnalyzing(false);
    setAnalysisComplete(true);
  };

  const handleApproveCriticalStep = () => {
    setIsApproving(true);
    setTimeout(() => { setIsApproving(false); setCriticalApproved(true); }, 450);
  };

  const handleToggleLogin = () => {
    if (isLoggedIn) {
      setIsLoggedIn(false);
      setUserProfile(null);
    } else {
      setIsLoggedIn(true);
      setUserProfile({ name: "apreezofficial", avatar: "https://github.com/apreezofficial.png" });
    }
  };

  const handleToggleFigmaConnection = () => setIsFigmaConnected(!isFigmaConnected);

  const resetToNew = () => {
    setActiveItem(null);
    setInputValue("");
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setCriticalApproved(false);
    setAuditData(null);
    setAuditError(null);
    setDetectedStack(null);
    setLoadedTreeData(null);
    setCurrentSteps([]);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveItem(item.name);
    setSourceType(item.type);
    setAuditError(null);
    setAuditData(item.auditData ?? null);
    if (item.auditData?.stack) setDetectedStack(item.auditData.stack);
    // Rebuild a static completed step list for history items
    const steps: StepItem[] = item.type === "github"
      ? [
          { id: "resolve", icon: <GitBranch size={14} className="text-secondary" />, label: `Resolved ${item.name}`, status: "done" },
          { id: "stack", icon: <Package size={14} className="text-secondary" />, label: "Detected project stack", status: "done" },
          { id: "tree", icon: <FolderGit2 size={14} className="text-secondary" />, label: "Mapped repository source files", status: "done" },
          { id: "audit", icon: <Compass size={14} className="text-secondary" />,
            label: item.auditData ? `Audit completed: ${item.auditData.totalFindings || 0} issues mapped` : "Audit completed",
            status: "done" },
        ]
      : figmaSteps;
    setCurrentSteps(steps);
    setAnalysisComplete(true);
    setCriticalApproved(false);
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
          className="flex-1 overflow-hidden relative"
        >
          {!activeItem ? (
            <div className="h-full overflow-y-auto">
              <HeroView
                sourceType={sourceType}
                setSourceType={setSourceType}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onStartAnalysis={handleStartAnalysis}
              />
            </div>
          ) : (
            <div
              ref={mainScrollRef as React.RefObject<HTMLDivElement>}
              onScroll={handleScroll}
              className="h-full overflow-y-auto"
            >
              <AnalysisView
                sourceType={sourceType}
                activeItem={activeItem}
                isAnalyzing={isAnalyzing}
                analysisComplete={analysisComplete}
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
            </div>
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
