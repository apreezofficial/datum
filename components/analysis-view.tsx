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
} from "lucide-react";
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
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
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
              ? `${currentSteps.length} steps — audit failed`
              : `${currentSteps.length} steps completed`}
          </span>
          {analysisComplete && (
            auditError && !auditData ? (
              <span className="text-peak font-mono ml-2">✗ Failed</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-mono ml-2">✓ Done</span>
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
          {/* Error State — shown when audit failed (repo not found, private, API error) */}
          {auditError && !auditData && (
            <div className="border border-peak/40 bg-peak/5 rounded-lg p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="text-peak shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-peak">
                    Audit Failed
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
                  Try another repository
                </button>
              </div>
            </div>
          )}

          {/* Only render GitHub/Figma results if there's no fatal error */}
          {!auditError && (
            <>
          {/* GITHUB FLOW RESULTS */}
          {sourceType === "github" ? (
            <div className="space-y-6">
              {/* GitHub Report Card */}
              <div className="border border-border rounded-lg bg-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between pb-3 border-b border-border-subtle gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-text truncate max-w-[220px] sm:max-w-none">
                        Codebase Survey · {activeItem}
                      </h2>
                      <span className="text-[10px] font-mono bg-tide/10 text-tide px-2 py-0.5 rounded-full shrink-0">
                        {activeModel.name}
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 line-clamp-2 sm:line-clamp-none">
                      {auditData?.summary || "Analyzing UI components for design system deviations..."}
                    </p>
                  </div>
                  <div className="text-left xs:text-right shrink-0 flex xs:flex-col items-center xs:items-end justify-between xs:justify-start">
                    <span className="text-[10px] text-muted font-mono block">DRIFT SCORE</span>
                    <span
                      className={`text-lg font-bold font-mono ${
                        (auditData?.driftScore ?? 0) >= 60
                          ? "text-peak"
                          : (auditData?.driftScore ?? 0) >= 30
                          ? "text-ochre"
                          : "text-emerald-500"
                      }`}
                    >
                      {auditData?.driftScore !== undefined ? `${auditData.driftScore} / 100` : "-- / 100"}
                    </span>
                  </div>
                </div>

                {/* Mismatches List */}
                <div className="space-y-2 text-xs font-mono">
                  {auditData?.deviations && auditData.deviations.length > 0 ? (
                    auditData.deviations.map((dev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 border border-border-subtle rounded bg-raised/40 flex items-center justify-between gap-2 sm:gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-muted truncate">
                          {dev.file}:{dev.line}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs">
                          <span className="text-peak line-through truncate max-w-[100px] xs:max-w-none">{dev.currentValue}</span>
                          <span className="text-muted text-[11px]">→</span>
                          <span className="text-tide font-medium truncate max-w-[160px] xs:max-w-none">
                            {dev.suggestedToken} ({dev.suggestedValue})
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="text-[11px] text-secondary block whitespace-nowrap">
                          Δ {typeof dev.delta === "number" ? `+${dev.delta}` : dev.delta}
                        </span>
                        <span className="text-[9px] text-muted font-sans whitespace-nowrap">
                          {dev.confidence > 1 ? dev.confidence : Math.round(dev.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="p-4 border border-border-subtle rounded bg-raised/20 text-center text-xs text-secondary">
                      No design deviations detected in surveyed component files. Tokens are in full alignment!
                    </div>
                  )}
                </div>
              </div>

              {/* GITHUB CRITICAL STEP: OPEN FIX PR (Only if deviations exist) */}
              {(auditData?.totalDeviations ?? 0) > 0 ? (
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
                            This will push branch <code className="font-mono text-text">datum/fix-design-drift</code> with {auditData?.totalDeviations ?? 0} token fixes and open a PR on GitHub.
                          </p>
                        </div>
                      </div>

                    <div className="pt-2 border-t border-border-subtle">
                      {!isLoggedIn ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                          <span className="text-xs text-secondary leading-relaxed">
                            Sign in to authorize PR creation.
                          </span>
                          <button
                            type="button"
                            onClick={handleToggleLogin}
                            className="flex items-center justify-center gap-1.5 rounded-md bg-accent text-accent-foreground px-3.5 py-2 sm:py-1.5 text-xs font-medium hover:opacity-90 shrink-0 w-full sm:w-auto"
                          >
                            <Github size={13} />
                            <span>Sign in with GitHub</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                          <span className="text-xs text-secondary truncate">
                            Signed in as <b className="text-text">{userProfile?.name}</b>
                          </span>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => alert("Action skipped.")}
                              className="flex-1 sm:flex-initial px-3 py-2 sm:py-1.5 text-xs text-secondary hover:text-text rounded border border-border bg-surface text-center"
                            >
                              Decline
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
                        </div>
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
                      PR #1: &ldquo;fix: align {auditData?.totalDeviations ?? 0} tokens with design system benchmarks&rdquo; was opened on <code className="font-mono text-text">{activeItem}</code>.
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
              ) : (
                <div className="border border-emerald-500/40 bg-emerald-500/5 rounded-lg p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-text">Design System In Full Alignment</h4>
                      <p className="text-xs text-secondary mt-0.5">
                        Zero token deviations found across all surveyed UI files on <code className="font-mono text-text">{activeItem}</code>. No Pull Request needed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetToNew}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border bg-surface text-text hover:bg-raised"
                  >
                    <RefreshCw size={12} />
                    <span>Audit another</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ================= FIGMA FLOW RESULTS ================= */
            <div className="space-y-6">
              {/* Figma Report Card */}
              <div className="border border-border rounded-lg bg-surface p-4 sm:p-5 space-y-4">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between pb-3 border-b border-border-subtle gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-text truncate max-w-[220px] sm:max-w-none">
                      Figma Token Sync Report · {activeItem}
                    </h2>
                    <p className="text-xs text-secondary mt-0.5 line-clamp-2 sm:line-clamp-none">
                      12 token discrepancies between Figma file and repository tokens.
                    </p>
                  </div>
                  <div className="text-left xs:text-right shrink-0 flex xs:flex-col items-center xs:items-end justify-between xs:justify-start">
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
          </>
          )}
        </div>
      )}
    </div>
  );
}
