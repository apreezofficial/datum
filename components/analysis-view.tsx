"use client";

import * as React from "react";
import {
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  RefreshCw,
  Github,
  Figma,
  Bug,
  Zap,
  ListTodo,
  Copy,
  Download,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StepItem, AuditData, ModelOption } from "@/types/datum";

interface AnalysisViewProps {
  sourceType: "github" | "figma";
  activeItem: string;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  currentSteps: StepItem[];
  stepsExpanded: boolean;
  setStepsExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  activeModel: ModelOption;
  auditData: AuditData | null;
  auditError: string | null;
  criticalApproved: boolean;
  isApproving: boolean;
  isLoggedIn: boolean;
  userProfile: { name: string; avatar: string } | null;
  isFigmaConnected: boolean;
  handleToggleLogin: () => void;
  handleToggleFigmaConnection: () => void;
  handleApproveCriticalStep: () => void;
  resetToNew: () => void;
}

export function AnalysisView({
  sourceType,
  activeItem,
  isAnalyzing,
  analysisComplete,
  currentSteps,
  stepsExpanded,
  setStepsExpanded,
  activeModel,
  auditData,
  auditError,
  criticalApproved,
  isApproving,
  isLoggedIn,
  userProfile,
  isFigmaConnected,
  handleToggleLogin,
  handleToggleFigmaConnection,
  handleApproveCriticalStep,
  resetToNew,
}: AnalysisViewProps) {
  // Category filter state for findings
  const [activeCategoryFilter, setActiveCategoryFilter] = React.useState<
    "all" | "security" | "bug" | "performance" | "architecture" | "todo"
  >("all");

  const [copiedFixIndex, setCopiedFixIndex] = React.useState<number | null>(null);
  const [copiedAllPatches, setCopiedAllPatches] = React.useState(false);

  const findings = auditData?.findings || [];
  const todos = auditData?.todosFound || [];

  const securityCount = findings.filter((f) => f.category === "security").length;
  const bugCount = findings.filter((f) => f.category === "bug").length;
  const perfCount = findings.filter((f) => f.category === "performance").length;
  const archCount = findings.filter((f) => f.category === "architecture").length;
  const todoCount = todos.length;

  const filteredFindings =
    activeCategoryFilter === "all"
      ? findings
      : activeCategoryFilter === "todo"
      ? []
      : findings.filter((f) => f.category === activeCategoryFilter);

  // Copy single fix to clipboard
  const handleCopySingleFix = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedFixIndex(index);
    setTimeout(() => setCopiedFixIndex(null), 2000);
  };

  // Copy all suggested fixes as a markdown checklist
  const handleCopyAllPatches = () => {
    if (!auditData) return;
    const patchText = findings
      .map((f, i) => {
        return `### Flaw ${i + 1}: ${f.title} (${f.category} - ${f.severity})\n- **File:** \`${f.file}:${f.line}\`\n- **Issue:** ${f.description}\n- **Fix:** ${f.suggestedFix || "See description"}\n`;
      })
      .join("\n---\n\n");

    navigator.clipboard.writeText(patchText);
    setCopiedAllPatches(true);
    setTimeout(() => setCopiedAllPatches(false), 2000);
  };

  // Export full audit report as a downloadable markdown document
  const handleExportReport = () => {
    if (!auditData) return;
    const reportMd = `# Codebase Flaw Audit Report: ${activeItem}
Model: ${activeModel.name}
Health Score: ${auditData.healthScore} / 100
Date: ${new Date().toISOString()}

## Summary
${auditData.summary}

## Mapped Flaws (${findings.length})
${findings
  .map(
    (f, i) =>
      `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.category})\n- **Location:** \`${f.file}:${f.line}\`\n- **Details:** ${f.description}\n- **Suggested Fix:** \`${f.suggestedFix || "N/A"}\`\n`
  )
  .join("\n")}

## In-Code Work In Progress & TODOs (${todos.length})
${todos.map((t) => `- \`${t.file}:${t.line}\`: ${t.text}`).join("\n")}
`;

    const blob = new Blob([reportMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `datum-audit-${activeItem.replace("/", "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
      {/* Expandable Steps Section */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setStepsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-xs font-mono text-secondary hover:text-text focus:outline-none"
        >
          {stepsExpanded ? (
            <ChevronDown size={14} className="text-muted" />
          ) : (
            <ChevronRight size={14} className="text-muted" />
          )}
          <span>
            {isAnalyzing
              ? (() => {
                  const runningIdx = currentSteps.findIndex((s) => s.status === "running");
                  const pos = runningIdx >= 0 ? runningIdx + 1 : currentSteps.length + 1;
                  return `Step ${pos} in progress...`;
                })()
              : auditError && !auditData
              ? `${currentSteps.length} steps — analysis failed`
              : `${currentSteps.length} steps completed`}
          </span>
          {analysisComplete && (
            auditError && !auditData ? (
              <span className="text-peak font-mono ml-2">Failed</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-mono ml-2">Done</span>
            )
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
          {/* Error State */}
          {auditError && !auditData && (
            <div className="border border-peak/40 bg-peak/5 rounded-lg p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="text-peak shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-peak">
                    Analysis Failed
                  </span>
                  <h3 className="text-sm font-bold text-text mt-0.5">
                    Could not analyze <code className="font-mono">{activeItem}</code>
                  </h3>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">{auditError}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border-subtle flex justify-end">
                <button
                  type="button"
                  onClick={resetToNew}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-surface border border-border text-text hover:bg-raised"
                >
                  <RefreshCw size={12} />
                  <span>Try another target</span>
                </button>
              </div>
            </div>
          )}

          {/* Render GitHub/Figma results if there's no fatal error */}
          {!auditError && (
            <>
              {/* GITHUB FLOW RESULTS */}
              {sourceType === "github" ? (
                <div className="space-y-6">
                  {/* GitHub Report Card */}
                  <div className="border border-border rounded-xl bg-surface p-4 sm:p-6 space-y-5 shadow-xs">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between pb-4 border-b border-border-subtle gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-text truncate max-w-[280px] sm:max-w-none">
                            Codebase Flaw Audit · {activeItem}
                          </h2>
                          <span className="text-[10px] font-mono bg-tide/10 text-tide px-2 py-0.5 rounded-full shrink-0">
                            {activeModel.name}
                          </span>
                        </div>
                        <div className="text-xs text-secondary mt-1 font-mono">
                          {auditData?.stack
                            ? `${auditData.stack.language} · ${auditData.stack.ecosystem} · ${auditData.stack.stylingSystem}`
                            : "Multi-Language Codebase"}
                        </div>
                      </div>

                      <div className="text-left xs:text-right shrink-0 flex xs:flex-col items-center xs:items-end justify-between xs:justify-start">
                        <span className="text-[10px] text-muted font-mono block">HEALTH SCORE</span>
                        <span
                          className={`text-xl font-bold font-mono ${
                            (auditData?.healthScore ?? 100) >= 80
                              ? "text-emerald-500"
                              : (auditData?.healthScore ?? 100) >= 50
                              ? "text-ochre"
                              : "text-peak"
                          }`}
                        >
                          {auditData?.healthScore !== undefined ? `${auditData.healthScore} / 100` : "100 / 100"}
                        </span>
                      </div>
                    </div>

                    {/* Summary Overview */}
                    {auditData?.summary && (
                      <div className="text-xs sm:text-sm text-secondary leading-relaxed bg-raised/30 p-3.5 rounded-lg border border-border/40">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {auditData.summary}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Category Filter Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter("all")}
                        className={`px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
                          activeCategoryFilter === "all"
                            ? "bg-accent text-accent-foreground border-accent font-semibold"
                            : "bg-surface border-border text-secondary hover:text-text"
                        }`}
                      >
                        All Flaws ({findings.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter("security")}
                        className={`px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
                          activeCategoryFilter === "security"
                            ? "bg-peak/20 text-peak border-peak font-semibold"
                            : "bg-surface border-border text-secondary hover:text-text"
                        }`}
                      >
                        <ShieldAlert size={11} />
                        <span>Security ({securityCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter("bug")}
                        className={`px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
                          activeCategoryFilter === "bug"
                            ? "bg-ochre/20 text-ochre border-ochre font-semibold"
                            : "bg-surface border-border text-secondary hover:text-text"
                        }`}
                      >
                        <Bug size={11} />
                        <span>Bugs ({bugCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter("performance")}
                        className={`px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
                          activeCategoryFilter === "performance"
                            ? "bg-tide/20 text-tide border-tide font-semibold"
                            : "bg-surface border-border text-secondary hover:text-text"
                        }`}
                      >
                        <Zap size={11} />
                        <span>Performance ({perfCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveCategoryFilter("todo")}
                        className={`px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
                          activeCategoryFilter === "todo"
                            ? "bg-accent text-accent-foreground border-accent font-semibold"
                            : "bg-surface border-border text-secondary hover:text-text"
                        }`}
                      >
                        <ListTodo size={11} />
                        <span>In-Code TODOs ({todoCount})</span>
                      </button>
                    </div>

                    {/* Filtered Findings List */}
                    {activeCategoryFilter !== "todo" && (
                      <div className="space-y-3 font-mono text-xs">
                        {filteredFindings.length > 0 ? (
                          filteredFindings.map((f, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 border border-border-subtle rounded-lg bg-raised/40 space-y-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${
                                      f.category === "security"
                                        ? "bg-peak/15 text-peak border border-peak/30"
                                        : f.category === "bug"
                                        ? "bg-ochre/15 text-ochre border border-ochre/30"
                                        : f.category === "performance"
                                        ? "bg-tide/15 text-tide border border-tide/30"
                                        : "bg-surface border border-border text-secondary"
                                    }`}
                                  >
                                    {f.category}
                                  </span>
                                  <span className="text-xs font-semibold text-text truncate">{f.title}</span>
                                </div>
                                <span
                                  className={`text-[10px] capitalize shrink-0 ${
                                    f.severity === "high"
                                      ? "text-peak font-bold"
                                      : f.severity === "medium"
                                      ? "text-ochre"
                                      : "text-muted"
                                  }`}
                                >
                                  {f.severity} severity
                                </span>
                              </div>

                              <div className="text-[11px] text-secondary font-sans leading-relaxed">
                                {f.description}
                              </div>

                              <div className="text-[10px] text-muted font-mono flex items-center gap-1">
                                <span>File:</span>
                                <code className="font-semibold text-text/80">{f.file}:{f.line}</code>
                              </div>

                              {f.suggestedFix && (
                                <div className="flex items-center justify-between text-[11px] bg-surface/90 p-2 rounded border border-border/60">
                                  <span className="text-text font-mono truncate mr-2">
                                    <b className="text-secondary">Fix:</b> {f.suggestedFix}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopySingleFix(f.suggestedFix!, idx)}
                                    className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-text px-2 py-0.5 rounded bg-raised border border-border shrink-0 transition-colors"
                                  >
                                    {copiedFixIndex === idx ? (
                                      <Check size={11} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={11} />
                                    )}
                                    <span>{copiedFixIndex === idx ? "Copied" : "Copy"}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 border border-border-subtle rounded-lg bg-raised/20 text-center text-xs text-secondary font-sans">
                            No flaws detected in this category.
                          </div>
                        )}
                      </div>
                    )}

                    {/* In-Code TODOs List */}
                    {(activeCategoryFilter === "all" || activeCategoryFilter === "todo") && todos.length > 0 && (
                      <div className="pt-3 border-t border-border-subtle space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">
                            Genuine In-Code TODOs & Work In Progress ({todos.length})
                          </span>
                        </div>
                        <div className="space-y-1.5 font-mono text-xs">
                          {todos.map((t, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 border border-border-subtle rounded bg-raised/30 flex items-start gap-2.5"
                            >
                              <span className="text-[10px] text-secondary shrink-0 pt-0.5">
                                {t.file}:{t.line}
                              </span>
                              <span className="text-[11px] text-text font-sans flex-1">
                                {t.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACTION BAR: COPY PATCHES, EXPORT REPORT & MAINTAINER PR */}
                  {(auditData?.totalFindings ?? 0) > 0 ? (
                    <div
                      className={`border rounded-xl p-5 transition-all shadow-xs space-y-4 ${
                        criticalApproved
                          ? "border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-text">
                            Remediation & Export Actions
                          </h3>
                          <p className="text-xs text-secondary mt-0.5">
                            Apply or share fixes for the {auditData?.totalFindings ?? 0} mapped security and reliability findings.
                          </p>
                        </div>

                        {/* Quick Utility Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleCopyAllPatches}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-raised border border-border text-text hover:bg-raised/80 transition-colors"
                          >
                            {copiedAllPatches ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>{copiedAllPatches ? "Copied" : "Copy All Patches"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleExportReport}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded bg-raised border border-border text-text hover:bg-raised/80 transition-colors"
                          >
                            <Download size={12} />
                            <span>Export (.md)</span>
                          </button>
                        </div>
                      </div>

                      {/* Pull Request Flow */}
                      <div className="pt-3 border-t border-border-subtle">
                        {!criticalApproved ? (
                          <div className="p-3 bg-raised/30 rounded-lg border border-border/40 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-text">
                                Repository Maintainer or Fork Contributor?
                              </span>
                              <span className="text-[10px] font-mono text-muted">
                                Branch: datum/flaw-fixes
                              </span>
                            </div>

                            <p className="text-xs text-secondary leading-relaxed">
                              If you have push access or wish to create a pull request proposing these fixes, authorize with your GitHub account.
                            </p>

                            <div className="pt-1 flex items-center justify-between gap-2">
                              {!isLoggedIn ? (
                                <button
                                  type="button"
                                  onClick={handleToggleLogin}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-accent text-accent-foreground hover:opacity-90"
                                >
                                  <Github size={13} />
                                  <span>Sign in with GitHub to Open PR</span>
                                </button>
                              ) : (
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs text-secondary truncate">
                                    Signed in as <b className="text-text">{userProfile?.name}</b>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isApproving}
                                    onClick={handleApproveCriticalStep}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-accent text-accent-foreground hover:opacity-90"
                                  >
                                    {isApproving ? (
                                      <>
                                        <Loader2 size={13} className="animate-spin" />
                                        <span>Opening PR...</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck size={13} />
                                        <span>Open Fix PR</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 text-xs">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={18} />
                              <span>PR Opened on GitHub</span>
                            </div>
                            <p className="text-secondary text-xs pl-6 leading-relaxed">
                              Branch <code className="font-mono text-text">datum/flaw-fixes</code> with proposed patches has been submitted to <code className="font-mono text-text">{activeItem}</code>.
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
                              <button
                                type="button"
                                onClick={resetToNew}
                                className="inline-flex items-center gap-1 text-secondary hover:text-text font-mono text-xs"
                              >
                                <RefreshCw size={12} />
                                <span>Inspect another codebase</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-emerald-500/40 bg-emerald-500/5 rounded-xl p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-text">Codebase in Good Health</h4>
                          <p className="text-xs text-secondary mt-0.5">
                            Zero critical security vulnerabilities or defects identified on <code className="font-mono text-text">{activeItem}</code>.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetToNew}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border bg-surface text-text hover:bg-raised"
                      >
                        <RefreshCw size={12} />
                        <span>Inspect another</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ================= FIGMA FLOW RESULTS ================= */
                <div className="space-y-6">
                  {/* Figma Report Card */}
                  <div className="border border-border rounded-xl bg-surface p-4 sm:p-6 space-y-5 shadow-xs">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between pb-4 border-b border-border-subtle gap-2">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-text truncate max-w-[280px] sm:max-w-none">
                          Figma Design Flaw & Parity Audit · {activeItem}
                        </h2>
                        <p className="text-xs text-secondary mt-0.5">
                          12 token discrepancies and design flaws detected between Figma variables and repository code.
                        </p>
                      </div>
                      <div className="text-left xs:text-right shrink-0 flex xs:flex-col items-center xs:items-end justify-between xs:justify-start">
                        <span className="text-[10px] text-muted font-mono block">PARITY SCORE</span>
                        <span className="text-xl font-bold font-mono text-ochre">68 / 100</span>
                      </div>
                    </div>

                    {/* Figma Mismatch Breakdown */}
                    <div className="space-y-2.5 text-xs font-mono">
                      <div className="p-3 border border-border-subtle rounded-lg bg-raised/40 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-muted uppercase tracking-wider">Color Flaw · Brand Primary</div>
                          <div className="flex items-center gap-2 mt-1 font-mono">
                            <span className="text-tide">Figma: #3B82F6</span>
                            <span className="text-secondary">vs</span>
                            <span className="text-peak">Code: #3B82F7 (1 hex shift)</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-ochre/15 text-ochre font-semibold">Value Differs</span>
                      </div>

                      <div className="p-3 border border-border-subtle rounded-lg bg-raised/40 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-muted uppercase tracking-wider">Spacing Flaw · Card Padding</div>
                          <div className="flex items-center gap-2 mt-1 font-mono">
                            <span className="text-tide">Figma: 16px</span>
                            <span className="text-secondary">vs</span>
                            <span className="text-peak">Code: 13px (arbitrary px)</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-ochre/15 text-ochre font-semibold">Value Differs</span>
                      </div>

                      <div className="p-3 border border-border-subtle rounded-lg bg-raised/40 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-muted uppercase tracking-wider">Radius Flaw · Button Radius</div>
                          <div className="flex items-center gap-2 mt-1 font-mono">
                            <span className="text-tide">Figma: 6px (rounded-md)</span>
                            <span className="text-secondary">vs</span>
                            <span className="text-muted">Code: Missing Token</span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-peak/15 text-peak font-semibold">Missing in Code</span>
                      </div>
                    </div>
                  </div>

                  {/* FIGMA CRITICAL STEP: SYNC TOKENS TO CODE */}
                  <div
                    className={`border rounded-xl p-5 transition-all shadow-xs ${
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
                              Design Parity Authorization
                            </span>
                            <h3 className="text-sm font-bold text-text mt-0.5">
                              Sync 12 Figma Tokens into Codebase?
                            </h3>
                            <p className="text-xs text-secondary mt-1 leading-relaxed">
                              This will write updated canonical design tokens directly into your repository&apos;s <code className="font-mono text-text">styles/tokens.ts</code> to resolve design flaws.
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border-subtle">
                          {!isFigmaConnected ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                              <span className="text-xs text-secondary leading-relaxed">
                                Connect Figma to authorize syncing design tokens to your repository.
                              </span>
                              <button
                                type="button"
                                onClick={handleToggleFigmaConnection}
                                className="flex items-center justify-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3.5 py-2 sm:py-1.5 text-xs font-medium hover:opacity-90 shrink-0 w-full sm:w-auto"
                              >
                                <Figma size={13} />
                                <span>Connect Figma Account</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                              <span className="text-xs text-secondary truncate">
                                Authorized via <b className="text-text">Figma Token Connection</b>
                              </span>
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => alert("Sync cancelled.")}
                                  className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 text-xs text-secondary hover:text-text rounded border border-border bg-surface text-center"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isApproving}
                                  onClick={handleApproveCriticalStep}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-medium rounded bg-accent text-accent-foreground hover:opacity-90"
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
                            </div>
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
                          12 canonical tokens successfully updated in <code className="font-mono text-text">styles/tokens.ts</code>. Design parity is restored.
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
