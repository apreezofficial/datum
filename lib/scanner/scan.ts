import type { AuditFinding } from "@/types/datum";
import { ALL_RULES } from "./rules";

export interface TodoItem {
  file: string;
  line: number;
  text: string;
}

export interface FileScanResult {
  findings: AuditFinding[];
  todos: TodoItem[];
}

const TODO_RE = /(?:\/\/|#|\/\*+|\*|<!--|--|;)\s*(TODO|FIXME|HACK|XXX)\b[:\s(-]*(.*)$/;
const MAX_LINE = 400;

const PLACEHOLDER_RE = /(example|your[_-]|xxx|changeme|placeholder|dummy|sample|<.*>|\.\.\.)/i;
const SKIP_FILE_RE = /(\.min\.|\.lock$|-lock\.|\.map$|\.snap$|\.(png|jpe?g|gif|svg|ico|woff2?|ttf|pdf|zip)$)/i;
const DOC_OR_TEST_RE = /(^|\/)(__tests__|tests?|fixtures?|examples?|docs?)\/|\.(test|spec)\.|\.md$/i;
const ENV_EXAMPLE_RE = /\.env\.(example|sample|template)$/i;
const KEY_FORMAT_RULES = ["aws-access-key", "private-key", "github-token", "api-secret-key"];

export function shouldScanFile(path: string): boolean {
  return !SKIP_FILE_RE.test(path);
}

/**
 * Deterministic scan of a single file: every finding and TODO returned here
 * literally appears in the content at the reported line.
 */
export function scanFile(path: string, content: string): FileScanResult {
  const findings: AuditFinding[] = [];
  const todos: TodoItem[] = [];
  if (!shouldScanFile(path)) return { findings, todos };

  const isDocOrTest = DOC_OR_TEST_RE.test(path);
  const isEnvExample = ENV_EXAMPLE_RE.test(path);
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length > MAX_LINE * 10) continue; // minified / generated line
    const line = raw.length > MAX_LINE ? raw.slice(0, MAX_LINE) : raw;
    const lineNo = i + 1;

    const todo = TODO_RE.exec(line);
    if (todo) {
      const body = todo[2].replace(/\*\/\s*$/, "").trim();
      const text = body ? `${todo[1]}: ${body}` : todo[1];
      todos.push({ file: path, line: lineNo, text });
      findings.push({
        file: path,
        line: lineNo,
        category: "todo",
        severity: todo[1] === "FIXME" || todo[1] === "HACK" ? "medium" : "low",
        title: `${todo[1]} left in code`,
        description: text,
        snippet: line.trim(),
      });
      continue;
    }

    if (isEnvExample) continue;
    for (const rule of ALL_RULES) {
      if (rule.appliesTo && !rule.appliesTo.test(path)) continue;
      if (!rule.pattern.test(line)) continue;
      if (rule.category === "security" && rule.id !== "private-key" && PLACEHOLDER_RE.test(line)) continue;
      // Tests and docs routinely contain fake secrets; only flag unambiguous key formats there.
      if (isDocOrTest && !KEY_FORMAT_RULES.includes(rule.id)) continue;
      findings.push({
        file: path,
        line: lineNo,
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        snippet: line.trim().slice(0, 200),
        suggestedFix: rule.suggestedFix,
      });
    }
  }

  return { findings, todos };
}

/** Health score 0-100: weighted deductions with diminishing returns per severity. */
export function computeHealthScore(findings: AuditFinding[]): number {
  const weight = { high: 19, medium: 6, low: 1.2 } as const;
  let penalty = 0;
  for (const sev of ["high", "medium", "low"] as const) {
    const n = findings.filter((f) => f.severity === sev && f.category !== "todo").length;
    penalty += weight[sev] * Math.sqrt(n);
  }
  const todoCount = findings.filter((f) => f.category === "todo").length;
  penalty += Math.min(10, Math.sqrt(todoCount));
  return Math.max(0, Math.round(100 - penalty));
}
