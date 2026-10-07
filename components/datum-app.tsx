"use client";

import * as React from "react";
import { useTheme } from "@/lib/theme";
import type { StackInfo } from "@/lib/stack-detector";
import type { ScanEvent } from "@/app/api/scan/route";
import {
  GitBranch,
  FolderGit2,
  Package,
  FileCode,
  Layers,
  Compass,
  ArrowDown,
} from "lucide-react";

import { DatumHeader } from "@/components/datum-header";
import { DatumSidebar } from "@/components/datum-sidebar";
import { DatumFooter } from "@/components/datum-footer";
import { HeroView } from "@/components/hero-view";
import { FolderPicker, type FolderSelection } from "@/components/folder-picker";
import { AnalysisView } from "@/components/analysis-view";

import type {
  StepItem,
  AuditData,
  ModelOption,
  HistoryItem,
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

  // Open the sidebar by default on desktop only; on phones it is a drawer.
  React.useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(true);
  }, []);

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [auditData, setAuditData] = React.useState<AuditData | null>(null);
  const [auditError, setAuditError] = React.useState<string | null>(null);
  const [folderSelection, setFolderSelection] = React.useState<FolderSelection | null>(null);
  const [detectedStack, setDetectedStack] = React.useState<StackInfo | null>(null);

  // Model selection
  const [models, setModels] = React.useState<ModelOption[]>(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = React.useState("openai/gpt-oss-120b");

  // Survey state
  const [inputValue, setInputValue] = React.useState("");
  const [activeItem, setActiveItem] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisComplete, setAnalysisComplete] = React.useState(false);
  const [stepsExpanded, setStepsExpanded] = React.useState(true);

  // Dynamic step list — built step-by-step as things happen
  const [currentSteps, setCurrentSteps] = React.useState<StepItem[]>([]);

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
    if (!activeItem || !isAnalyzing) return;
    if (!userScrolledUpRef.current) scrollToBottom("auto");
  }, [currentSteps, isAnalyzing, activeItem, scrollToBottom]);

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

  // ─── Main Analysis Flow ───────────────────────────────────────────────────
  const handleStartAnalysis = async (urlToUse?: string, folders?: string[]) => {
    const rawUrl = urlToUse || inputValue;
    if (!rawUrl.trim()) return;

    const isFigma = rawUrl.toLowerCase().includes("figma.com");

    const cleanName = rawUrl
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");

    // Reset everything
    setActiveItem(cleanName);
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setAuditData(null);
    setAuditError(null);
    setDetectedStack(null);
    setCurrentSteps([]);
    if (!folders) setFolderSelection(null);

    const finish = (name: string, summary: string, data?: AuditData) => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      setHistory((prev) => [
        { id: Math.random().toString(), name, type: "github", summary, auditData: data },
        ...prev.filter((h) => h.name !== name),
      ]);
    };

    if (isFigma) {
      setAuditError("Figma links are not supported. Enter a GitHub repository as owner/repo.");
      finish(cleanName, "Unsupported source");
      return;
    }

    pushStep({
      id: "resolve",
      icon: <GitBranch size={14} className="text-secondary" />,
      label: `Resolving ${cleanName}...`,
      status: "running",
    });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: cleanName, model: selectedModelId, folders }),
      });
      if (!res.body) throw new Error("No response from scanner");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: AuditData | null = null;
      let failure: string | null = null;
      let selectionRequested = false;

      const handle = (e: ScanEvent) => {
        switch (e.type) {
          case "tree":
            updateLastStep({
              label: `Resolved ${e.repo}@${e.branch} — ${e.totalFiles.toLocaleString()} files, ${e.scannable.toLocaleString()} scannable${e.truncated ? " (tree truncated by GitHub)" : ""}`,
              status: "done",
            });
            pushStep({
              id: "scan",
              icon: <FileCode size={14} className="text-secondary" />,
              label: "Scanning files...",
              status: "running",
            });
            break;
          case "select":
            selectionRequested = true;
            setFolderSelection({ repo: e.repo, total: e.total, limit: e.limit, groups: e.groups });
            updateLastStep({
              label: `${e.repo} has ${e.total.toLocaleString()} scannable files — choose which folders to scan`,
              status: "done",
            });
            break;
          case "progress":
            updateLastStep({
              label: `Scanning ${e.file} (${e.scanned.toLocaleString()} / ${e.total.toLocaleString()} files · ${e.findings} findings so far)`,
              status: "running",
            });
            break;
          case "ai":
            if (e.status === "running") {
              updateLastStep({ label: "Static scan complete", status: "done" });
              pushStep({
                id: "ai",
                icon: <Compass size={14} className="text-secondary" />,
                label: "AI reviewing the highest-risk files...",
                status: "running",
              });
            } else if (e.status === "done") {
              updateLastStep({ label: "AI review complete", status: "done" });
            } else {
              updateLastStep({ label: e.note ?? "AI review skipped", status: "done" });
            }
            break;
          case "result":
            finalData = e.data;
            break;
          case "error":
            failure = e.error;
            break;
        }
      };

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) handle(JSON.parse(line) as ScanEvent);
        }
      }

      if (selectionRequested) {
        setIsAnalyzing(false);
        return;
      }

      if (failure || !finalData) {
        updateLastStep({ label: "Scan failed", status: "done" });
        setAuditError(failure ?? "The scan ended without a result.");
        finish(cleanName, "Failed");
        return;
      }

      const data: AuditData = finalData;
      setAuditData(data);
      if (data.stack) setDetectedStack(data.stack);
      pushStep({
        id: "done",
        icon: <Layers size={14} className="text-secondary" />,
        label: `Done: ${data.totalFindings} findings across ${data.totalFilesScanned.toLocaleString()} files · health ${data.healthScore}/100`,
        status: "done",
      });
      finish(cleanName, `${data.totalFindings} findings`, data);
    } catch (err) {
      updateLastStep({ label: "Scan failed", status: "done" });
      setAuditError(err instanceof Error ? err.message : "Network error while scanning.");
      finish(cleanName, "Failed");
    }
  };


  const resetToNew = () => {
    setActiveItem(null);
    setInputValue("");
    setIsAnalyzing(false);
    setAnalysisComplete(false);
    setAuditData(null);
    setAuditError(null);
    setDetectedStack(null);
    setFolderSelection(null);
    setCurrentSteps([]);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setActiveItem(item.name);
    setAuditError(null);
    setAuditData(item.auditData ?? null);
    if (item.auditData?.stack) setDetectedStack(item.auditData.stack);
    // Rebuild clean completed step list for history items
    const steps: StepItem[] = [
          { id: "resolve", icon: <GitBranch size={14} className="text-secondary" />, label: `Resolved ${item.name}`, status: "done" },
          { id: "stack", icon: <Package size={14} className="text-secondary" />, label: `Detected stack · ${item.auditData?.stack?.language ?? "unknown"}`, status: "done" },
          { id: "tree", icon: <FolderGit2 size={14} className="text-secondary" />, label: "Mapped and indexed repository source files across codebase", status: "done" },
          { id: "audit", icon: <Compass size={14} className="text-secondary" />,
            label: item.auditData ? `Analysis completed: ${item.auditData.totalFindings || 0} flaws mapped · Score ${item.auditData.healthScore}/100` : "Analysis completed",
            status: "done" },
      ];
    setCurrentSteps(steps);
    setAnalysisComplete(true);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg text-text">
      {/* 1. Collapsible Sidebar */}
      <DatumSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        history={history}
        activeItem={activeItem}
        theme={theme}
        onToggleTheme={toggleTheme}
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
          analysisComplete={analysisComplete}
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
        />

        {/* Content Area */}
        <main
          className="flex-1 min-h-0 overflow-hidden relative"
        >
          {!activeItem ? (
            <div className="h-full overflow-y-auto">
              <HeroView
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
                activeItem={activeItem}
                isAnalyzing={isAnalyzing}
                analysisComplete={analysisComplete}
                currentSteps={currentSteps}
                stepsExpanded={stepsExpanded}
                setStepsExpanded={setStepsExpanded}
                activeModel={activeModel}
                auditData={auditData}
                auditError={auditError}
                resetToNew={resetToNew}
              />
              {folderSelection && (
                <div className="px-4 sm:px-6 pb-8 max-w-4xl mx-auto w-full">
                  <FolderPicker
                    selection={folderSelection}
                    busy={isAnalyzing}
                    onScan={(folders) => handleStartAnalysis(folderSelection.repo, folders)}
                  />
                </div>
              )}
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
