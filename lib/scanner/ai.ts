import type { AuditFinding } from "@/types/datum";
import { callGroqChat, getAllApiKeys } from "@/lib/groq";

export interface AiReviewResult {
  findings: AuditFinding[];
  summary: string;
  modelUsed: string;
}

const CHAR_BUDGET = 22_000;
const PER_FILE = 3_500;

export function aiAvailable(): boolean {
  return getAllApiKeys().length > 0;
}

/**
 * Asks the model to review the highest-risk files for logic bugs and
 * security issues the regex rules cannot see. Static findings are passed in
 * so the model does not repeat them.
 */
export async function aiReview(opts: {
  repo: string;
  files: Array<{ path: string; content: string }>;
  staticFindings: AuditFinding[];
  model?: string;
}): Promise<AiReviewResult> {
  let budget = CHAR_BUDGET;
  const included: string[] = [];
  const knownPaths = new Set<string>();
  for (const f of opts.files) {
    if (budget < 600) break;
    const body = f.content.slice(0, Math.min(PER_FILE, budget - 100));
    // Number lines so the model can cite real line numbers.
    const numbered = body
      .split("\n")
      .map((l, i) => `${i + 1}: ${l}`)
      .join("\n");
    included.push(`=== FILE: ${f.path} ===\n${numbered}`);
    knownPaths.add(f.path);
    budget -= body.length + 40;
  }

  const already = opts.staticFindings
    .slice(0, 40)
    .map((f) => `${f.file}:${f.line} ${f.title}`)
    .join("\n");

  const system = `You are Datum, a senior security and reliability code reviewer for "${opts.repo}".
Review the numbered source files. Report ONLY real problems visible in the given code: security vulnerabilities (injection, missing auth/validation, unsafe deserialization, SSRF, path traversal, secrets), logic and reliability bugs (unhandled errors, race conditions, null access, resource leaks), and serious performance problems.
Rules: never invent code that is not shown; "file" must be one of the given paths; "line" must be the number printed before the offending line; do not repeat these already-detected issues:
${already || "(none)"}
Return ONLY JSON: {"summary": string, "findings": [{"file": string, "line": number, "category": "security"|"bug"|"performance"|"architecture", "severity": "high"|"medium"|"low", "title": string, "description": string, "snippet": string, "suggestedFix": string}]}. Return an empty findings array if the code is sound.`;

  const { content, modelUsed } = await callGroqChat(
    [
      { role: "system", content: system },
      { role: "user", content: included.join("\n\n") },
    ],
    { model: opts.model, jsonMode: true, temperature: 0.1 }
  );

  const parsed = JSON.parse(content) as { summary?: string; findings?: Partial<AuditFinding>[] };
  const categories = ["security", "bug", "performance", "architecture"];
  const severities = ["high", "medium", "low"];
  const findings = (parsed.findings ?? [])
    .filter(
      (f): f is AuditFinding =>
        !!f.file &&
        knownPaths.has(f.file) &&
        !!f.title &&
        !!f.description &&
        categories.includes(f.category ?? "") &&
        severities.includes(f.severity ?? "")
    )
    .map((f) => ({ ...f, line: Number.isFinite(f.line) ? Math.max(1, Math.floor(f.line)) : 1 }));

  return { findings, summary: parsed.summary?.trim() ?? "", modelUsed };
}
