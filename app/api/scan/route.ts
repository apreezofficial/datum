import { detectStack } from "@/lib/stack-detector";
import {
  fetchFileContent,
  fetchRepoTree,
  GitHubError,
  isScannable,
  mapPool,
  parseRepoInput,
  rankFile,
} from "@/lib/github";
import { computeHealthScore, scanFile } from "@/lib/scanner/scan";
import { aiAvailable, aiReview } from "@/lib/scanner/ai";
import { groupFolders, inFolders, type FolderGroup } from "@/lib/folders";
import type { AuditData, AuditFinding } from "@/types/datum";

export const runtime = "nodejs";
export const maxDuration = 300;

const LARGE_REPO_FILES = 1500;
const CONCURRENCY = 32;
const TIME_BUDGET_MS = 240_000;
const AI_BATCH_FILES = 6;
const AI_MAX_BATCHES = 6;

export type ScanEvent =
  | { type: "tree"; repo: string; branch: string; totalFiles: number; scannable: number; truncated: boolean }
  | { type: "select"; repo: string; branch: string; total: number; limit: number; groups: FolderGroup[] }
  | { type: "progress"; scanned: number; total: number; file: string; findings: number }
  | { type: "ai"; status: "running" | "skipped" | "done" | "failed"; note?: string }
  | { type: "result"; data: AuditData }
  | { type: "error"; error: string };

const severityOrder = { high: 0, medium: 1, low: 2 } as const;

function dedupe(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: Request) {
  let body: { repo?: string; model?: string; ai?: boolean; folders?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to validation
  }

  const ref = body.repo ? parseRepoInput(body.repo) : null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ScanEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!ref) {
          send({ type: "error", error: "Enter a GitHub repository as owner/repo or a github.com URL." });
          return;
        }

        const tree = await fetchRepoTree(ref, req.signal);
        const scannable = tree.entries
          .filter(isScannable)
          .sort((a, b) => rankFile(b.path) - rankFile(a.path));
        const repoName = `${tree.owner}/${tree.repo}`;

        if (!body.folders && scannable.length > LARGE_REPO_FILES) {
          send({
            type: "select",
            repo: repoName,
            branch: tree.branch,
            total: scannable.length,
            limit: LARGE_REPO_FILES,
            groups: groupFolders(scannable.map((e) => e.path), LARGE_REPO_FILES),
          });
          return;
        }
        const toRead = body.folders ? scannable.filter((e) => inFolders(e.path, body.folders!)) : scannable;

        send({
          type: "tree",
          repo: repoName,
          branch: tree.branch,
          totalFiles: tree.entries.length,
          scannable: toRead.length,
          truncated: tree.truncated,
        });

        const started = Date.now();
        const findings: AuditFinding[] = [];
        const todos: Array<{ file: string; line: number; text: string }> = [];
        const contents = new Map<string, string>();
        let scanned = 0;
        let lastSent = 0;

        await mapPool(toRead, CONCURRENCY, async (entry) => {
          if (Date.now() - started > TIME_BUDGET_MS || req.signal.aborted) return;
          const text = await fetchFileContent(tree, entry.path, req.signal);
          scanned++;
          if (text === null || text.includes("\u0000")) return;
          const r = scanFile(entry.path, text);
          findings.push(...r.findings);
          todos.push(...r.todos);
          if (r.findings.some((f) => f.category !== "todo") || rankFile(entry.path) >= 150) {
            contents.set(entry.path, text);
          }
          const now = Date.now();
          if (now - lastSent > 250 || scanned === toRead.length) {
            lastSent = now;
            send({ type: "progress", scanned, total: toRead.length, file: entry.path, findings: findings.length });
          }
        });

        const filesSkipped = tree.entries.length - scanned;
        const stack = detectStack(tree.entries.map((e) => e.path));

        // AI pass over the files most likely to hold real problems.
        let aiNote: string | undefined;
        let modelUsed: string | undefined;
        let summaryFromAi = "";
        let allFindings = dedupe(findings);

        if (body.ai === false) {
          send({ type: "ai", status: "skipped", note: "AI review disabled" });
        } else if (!aiAvailable()) {
          aiNote = "AI review skipped: no GROQ_API_KEY configured. Showing static scan results only.";
          send({ type: "ai", status: "skipped", note: aiNote });
        } else {
          send({ type: "ai", status: "running" });
          const flagged = new Set(allFindings.filter((f) => f.category !== "todo").map((f) => f.file));
          const candidates = [...contents.entries()]
            .map(([path, content]) => ({ path, content }))
            .sort(
              (a, b) =>
                Number(flagged.has(b.path)) - Number(flagged.has(a.path)) || rankFile(b.path) - rankFile(a.path)
            )
            ;
          try {
            const batches: Array<typeof candidates> = [];
            for (let i = 0; i < candidates.length && batches.length < AI_MAX_BATCHES; i += AI_BATCH_FILES) {
              batches.push(candidates.slice(i, i + AI_BATCH_FILES));
            }
            const reviews = await Promise.allSettled(
              batches.map((files) =>
                aiReview({ repo: repoName, files, staticFindings: allFindings, model: body.model })
              )
            );
            const ok = reviews.filter((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof aiReview>>> => x.status === "fulfilled");
            if (ok.length === 0) throw new Error("every AI batch failed");
            allFindings = dedupe([...allFindings, ...ok.flatMap((x) => x.value.findings)]);
            modelUsed = ok[0].value.modelUsed;
            summaryFromAi = ok[0].value.summary;
            if (ok.length < batches.length) aiNote = `AI reviewed ${ok.length} of ${batches.length} batches; the rest failed (likely rate limit).`;
            send({ type: "ai", status: "done" });
          } catch (err) {
            aiNote = `AI review failed (${err instanceof Error ? err.message : "unknown error"}). Showing static scan results only.`;
            send({ type: "ai", status: "failed", note: aiNote });
          }
        }

        allFindings.sort(
          (a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.file.localeCompare(b.file) || a.line - b.line
        );
        const issues = allFindings.filter((f) => f.category !== "todo");
        const healthScore = computeHealthScore(allFindings);
        const security = allFindings.filter((f) => f.category === "security").length;

        const data: AuditData = {
          repo: repoName,
          branch: tree.branch,
          modelUsed,
          stack,
          healthScore,
          driftScore: 100 - healthScore,
          totalFilesScanned: scanned,
          totalFindings: allFindings.length,
          totalDeviations: allFindings.length,
          findings: allFindings,
          todosFound: todos.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
          filesSkipped,
          aiNote,
          summary:
            summaryFromAi ||
            `Scanned ${scanned.toLocaleString()} files: ${security} security, ${issues.length - security} other issues, ${todos.length} TODO/FIXME markers.`,
        };
        send({ type: "result", data });
      } catch (err) {
        const message =
          err instanceof GitHubError || err instanceof Error ? err.message : "Scan failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
