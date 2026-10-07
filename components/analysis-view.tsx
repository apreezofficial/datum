"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Bug,
  Zap,
  ListTodo,
  Layers,
  Info,
} from "lucide-react";
import type { AuditData, AuditFinding, ModelOption, StepItem } from "@/types/datum";

const PAGE_SIZE = 25;

type CategoryFilter = "all" | AuditFinding["category"];
type SeverityFilter = "all" | AuditFinding["severity"];

const CATEGORY_META: Record<AuditFinding["category"], { label: string; icon: React.ElementType; tone: string }> = {
  security: { label: "Security", icon: ShieldAlert, tone: "bg-peak/15 text-peak border-peak/30" },
  bug: { label: "Bugs", icon: Bug, tone: "bg-ochre/15 text-ochre border-ochre/30" },
  performance: { label: "Performance", icon: Zap, tone: "bg-tide/15 text-tide border-tide/30" },
  architecture: { label: "Architecture", icon: Layers, tone: "bg-raised text-secondary border-border" },
  todo: { label: "TODOs", icon: ListTodo, tone: "bg-raised text-secondary border-border" },
};

const SEVERITY_TONE: Record<AuditFinding["severity"], string> = {
  high: "text-peak",
  medium: "text-ochre",
  low: "text-muted",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useCopied() {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const copy = React.useCallback(async (text: string) => {
    if (await copyText(text)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    }
  }, []);
  return { copied, copy };
}

function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const { copied, copy } = useCopied();
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className={`inline-flex items-center justify-center gap-1.5 rounded border border-border bg-raised px-2.5 py-1.5 text-[11px] font-mono text-secondary hover:text-text transition-colors shrink-0 ${className}`}
    >
      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

const FindingCard = React.memo(function FindingCard({ f }: { f: AuditFinding }) {
  const meta = CATEGORY_META[f.category];
  const Icon = meta.icon;
  return (
    <article className="rounded-lg border border-border-subtle bg-raised/40 p-3 sm:p-4 space-y-2.5 min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.tone}`}
        >
          <Icon size={10} />
          {meta.label}
        </span>
        <span className={`text-[11px] font-mono capitalize ${SEVERITY_TONE[f.severity]}`}>{f.severity}</span>
      </div>

      <h3 className="text-sm font-semibold text-text leading-snug break-words">{f.title}</h3>

      <code className="block text-[11px] font-mono text-secondary break-all">
        {f.file}:{f.line}
      </code>

      <p className="text-xs text-secondary leading-relaxed break-words">{f.description}</p>

      {f.snippet && (
        <pre className="overflow-x-auto rounded bg-surface border border-border-subtle px-2.5 py-2 text-[11px] font-mono text-text leading-relaxed">
          {f.snippet}
        </pre>
      )}

      {f.suggestedFix && (
        <div className="rounded border border-emerald-500/25 bg-emerald-500/5 p-2.5 flex flex-col xs:flex-row xs:items-start gap-2 xs:justify-between">
          <p className="text-xs text-text leading-relaxed break-words min-w-0">
            <b className="text-emerald-600 dark:text-emerald-400">How to fix: </b>
            {f.suggestedFix}
          </p>
          <CopyButton text={f.suggestedFix} className="self-start" />
        </div>
      )}
    </article>
  );
});

function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-500", bar: "bg-emerald-500" };
  if (score >= 50) return { text: "text-ochre", bar: "bg-ochre" };
  return { text: "text-peak", bar: "bg-peak" };
}

function buildReport(repo: string, data: AuditData): string {
  const lines = data.findings.map(
    (f, i) =>
      `### ${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.category})\n- **Location:** \`${f.file}:${f.line}\`\n- **Details:** ${f.description}\n- **How to fix:** ${f.suggestedFix || "See details"}\n`
  );
  return `# Datum scan: ${repo}\n\nHealth score: ${data.healthScore}/100\nFiles scanned: ${data.totalFilesScanned}\nDate: ${new Date().toISOString()}\n\n## Summary\n${data.summary}\n\n## Findings (${data.findings.length})\n\n${lines.join("\n")}`;
}

function buildFixList(data: AuditData): string {
  return data.findings
    .filter((f) => f.category !== "todo")
    .map((f, i) => `${i + 1}. ${f.title} — \`${f.file}:${f.line}\`\n   Fix: ${f.suggestedFix || f.description}`)
    .join("\n");
}

const Report = React.memo(function Report({
  activeItem,
  data,
  modelName,
  onReset,
}: {
  activeItem: string;
  data: AuditData;
  modelName: string;
  onReset: () => void;
}) {
  const [category, setCategory] = React.useState<CategoryFilter>("all");
  const [severity, setSeverity] = React.useState<SeverityFilter>("all");
  const [visible, setVisible] = React.useState(PAGE_SIZE);

  const counts = React.useMemo(() => {
    const c = { all: data.findings.length, security: 0, bug: 0, performance: 0, architecture: 0, todo: 0 };
    const s = { high: 0, medium: 0, low: 0 };
    for (const f of data.findings) {
      c[f.category]++;
      s[f.severity]++;
    }
    return { c, s };
  }, [data.findings]);

  const filtered = React.useMemo(
    () =>
      data.findings.filter(
        (f) => (category === "all" || f.category === category) && (severity === "all" || f.severity === severity)
      ),
    [data.findings, category, severity]
  );

  React.useEffect(() => setVisible(PAGE_SIZE), [category, severity, data]);

  const tone = scoreTone(data.healthScore);
  const exportReport = () => {
    const blob = new Blob([buildReport(activeItem, data)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `datum-${activeItem.replace(/[^\w.-]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const issueCount = data.findings.length - counts.c.todo;

  return (
    <div className="space-y-4">
      {/* Score + overview */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-text truncate">{activeItem}</h2>
            <p className="text-xs text-secondary mt-0.5 font-mono break-words">
              {data.stack ? [data.stack.language, ...data.stack.frameworks.slice(0, 3)].join(" · ") : "Codebase"}
              {data.branch ? ` · ${data.branch}` : ""}
            </p>
            <p className="text-[11px] text-muted mt-1 font-mono">{data.modelUsed ? `AI: ${modelName}` : "Static scan"}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-mono text-muted tracking-wider">HEALTH</div>
            <div className={`text-2xl sm:text-3xl font-bold font-mono leading-none ${tone.text}`}>
              {data.healthScore}
              <span className="text-sm text-muted">/100</span>
            </div>
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden" aria-hidden>
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${data.healthScore}%` }} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(
            [
              ["High", counts.s.high, "text-peak"],
              ["Medium", counts.s.medium, "text-ochre"],
              ["Low", counts.s.low, "text-secondary"],
              ["Files", data.totalFilesScanned, "text-text"],
            ] as const
          ).map(([label, value, cls]) => (
            <div key={label} className="rounded-lg bg-raised/50 border border-border-subtle px-3 py-2">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider">{label}</div>
              <div className={`text-lg font-bold font-mono ${cls}`}>{value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {data.summary && <p className="text-xs sm:text-sm text-secondary leading-relaxed">{data.summary}</p>}

        {(data.aiNote || (data.filesSkipped ?? 0) > 0) && (
          <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-raised/40 p-2.5 text-[11px] text-secondary leading-relaxed">
            <Info size={13} className="shrink-0 mt-0.5 text-muted" />
            <div className="space-y-0.5">
              {data.aiNote && <p>{data.aiNote}</p>}
              {(data.filesSkipped ?? 0) > 0 && (
                <p>
                  {data.filesSkipped!.toLocaleString()} files were not read (binaries, lockfiles, vendored or generated folders,
                  tests/docs/examples, files over 1 MB, or outside the selected folders).
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Findings */}
      {data.findings.length === 0 ? (
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-5 flex items-center gap-3">
          <ShieldCheck size={22} className="text-emerald-500 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-text">No flaws found</h3>
            <p className="text-xs text-secondary mt-0.5">Nothing flagged in the {data.totalFilesScanned.toLocaleString()} files scanned.</p>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-2.5">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-xs font-mono [scrollbar-width:none]">
              {(["all", "security", "bug", "performance", "architecture", "todo"] as const).map((key) => {
                const n = counts.c[key];
                if (key !== "all" && n === 0) return null;
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground border-accent font-semibold"
                        : "bg-surface border-border text-secondary hover:text-text"
                    }`}
                  >
                    {key === "all" ? "All" : CATEGORY_META[key].label} ({n})
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="text-muted mr-1">Severity</span>
              {(["all", "high", "medium", "low"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSeverity(key)}
                  className={`rounded px-2 py-1 capitalize transition-colors ${
                    severity === key ? "bg-raised text-text font-semibold" : "text-secondary hover:text-text"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-secondary">No findings match these filters.</p>
          ) : (
            <div className="space-y-3">
              {filtered.slice(0, visible).map((f) => (
                <FindingCard key={`${f.file}:${f.line}:${f.title}`} f={f} />
              ))}
              {visible < filtered.length && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="w-full rounded-lg border border-border bg-raised/50 py-2.5 text-xs font-mono text-text hover:bg-raised transition-colors"
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - visible)} more · {filtered.length - visible} remaining
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Actions */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-secondary">
          {issueCount} issue{issueCount === 1 ? "" : "s"} and {counts.c.todo} TODO{counts.c.todo === 1 ? "" : "s"} found.
          Copy the fixes or export the full report.
        </p>
        <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex gap-2 shrink-0">
          {issueCount > 0 && <CopyButton text={buildFixList(data)} label="Copy fixes" className="py-2" />}
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-border bg-raised px-2.5 py-2 text-[11px] font-mono text-secondary hover:text-text transition-colors"
          >
            <Download size={12} />
            <span>Export .md</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 rounded bg-accent px-2.5 py-2 text-[11px] font-mono font-medium text-accent-foreground hover:opacity-90"
          >
            <RefreshCw size={12} />
            <span>Scan another</span>
          </button>
        </div>
      </section>
    </div>
  );
});

const StepsPanel = React.memo(function StepsPanel({
  steps,
  expanded,
  setExpanded,
  isAnalyzing,
  failed,
}: {
  steps: StepItem[];
  expanded: boolean;
  setExpanded: (v: boolean | ((p: boolean) => boolean)) => void;
  isAnalyzing: boolean;
  failed: boolean;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 py-1 text-xs font-mono text-secondary hover:text-text focus:outline-none"
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
        <span>{isAnalyzing ? "Scanning..." : failed ? "Scan failed" : `${steps.length} steps completed`}</span>
      </button>
      {expanded && (
        <ul className="pl-1 space-y-2">
          {steps.map((s) => (
            <li
              key={s.id}
              className={`flex items-start gap-2.5 text-xs ${s.status === "running" ? "text-tide font-medium" : "text-text/85"}`}
            >
              <span className="w-4 shrink-0 pt-0.5 flex justify-center">
                {s.status === "done" ? (
                  <Check size={13} className="text-emerald-500" strokeWidth={2.2} />
                ) : s.status === "running" ? (
                  <Loader2 size={13} className="animate-spin text-tide" />
                ) : (
                  s.icon
                )}
              </span>
              <span className="font-mono min-w-0 break-all">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

interface AnalysisViewProps {
  activeItem: string;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  currentSteps: StepItem[];
  stepsExpanded: boolean;
  setStepsExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void;
  activeModel: ModelOption;
  auditData: AuditData | null;
  auditError: string | null;
  resetToNew: () => void;
}

export function AnalysisView({
  activeItem,
  isAnalyzing,
  analysisComplete,
  currentSteps,
  stepsExpanded,
  setStepsExpanded,
  activeModel,
  auditData,
  auditError,
  resetToNew,
}: AnalysisViewProps) {
  return (
    <div className="max-w-3xl mx-auto w-full px-3 sm:px-6 py-5 sm:py-8 space-y-5">
      <StepsPanel
        steps={currentSteps}
        expanded={stepsExpanded}
        setExpanded={setStepsExpanded}
        isAnalyzing={isAnalyzing}
        failed={!!auditError && !auditData}
      />

      {analysisComplete && auditError && !auditData && (
        <div className="rounded-xl border border-peak/40 bg-peak/5 p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-peak shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text break-words">Could not scan {activeItem}</h3>
              <p className="text-xs text-secondary mt-1 leading-relaxed break-words">{auditError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetToNew}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-2 text-xs font-medium text-text hover:bg-raised"
          >
            <RefreshCw size={12} />
            Try another repository
          </button>
        </div>
      )}

      {analysisComplete && auditData && (
        <Report activeItem={activeItem} data={auditData} modelName={auditData.modelUsed ?? activeModel.name} onReset={resetToNew} />
      )}
    </div>
  );
}
