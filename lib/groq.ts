import { detectRepositoryStack, StackInfo } from "./stack-detector";

export interface DesignDeviation {
  file: string;
  line: number;
  currentValue: string;
  suggestedToken: string;
  suggestedValue: string;
  delta: string | number;
  confidence: number;
}

export interface AuditResult {
  source: string;
  modelUsed: string;
  stack: StackInfo;
  driftScore: number;
  totalFilesScanned: number;
  totalDeviations: number;
  deviations: DesignDeviation[];
  summary: string;
}

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelOption {
  id: string;
  name: string;
  tier: string;
  description: string;
  isDefault?: boolean;
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const FALLBACK_MODELS_CHAIN = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "allam-2-7b",
];

export const STATIC_AUDIT_MODELS: ModelOption[] = [
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    tier: "Deep Reasoning",
    description: "Flagship deep reasoning for complex component ASTs & token trees",
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

/**
 * Key state tracking for up to 5 Groq API keys with rate-limit tracking
 */
interface KeyMetadata {
  key: string;
  cooldownUntil: number;
  remainingRequests: number;
  remainingTokens: number;
  lastResetRequests: string;
  lastResetTokens: string;
  totalCalls: number;
  failCount: number;
}

const keyStore: Map<string, KeyMetadata> = new Map();
let currentKeyIndex = 0;

/**
 * Collect all configured API keys (supports 1 to 5+ keys)
 */
export function getAllApiKeys(): string[] {
  const keys: string[] = [];

  if (process.env.GROQ_API_KEYS) {
    const list = process.env.GROQ_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    for (const k of list) {
      if (!keys.includes(k)) keys.push(k);
    }
  }

  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]?.trim();
    if (k && !keys.includes(k)) {
      keys.push(k);
    }
  }

  const single = process.env.GROQ_API_KEY?.trim();
  if (single && !keys.includes(single)) {
    keys.push(single);
  }

  return keys;
}

/**
 * Select the best available key, skipping keys currently under rate-limit cooldown
 */
function pickNextKey(keys: string[]): { key: string; index: number } | null {
  if (keys.length === 0) return null;

  const now = Date.now();

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    const candidate = keys[idx];
    const meta = keyStore.get(candidate);

    if (!meta || meta.cooldownUntil < now) {
      currentKeyIndex = (idx + 1) % keys.length;
      return { key: candidate, index: idx };
    }
  }

  let earliest = keys[0];
  let minCooldown = Infinity;
  for (const k of keys) {
    const meta = keyStore.get(k);
    const time = meta?.cooldownUntil ?? 0;
    if (time < minCooldown) {
      minCooldown = time;
      earliest = k;
    }
  }

  return { key: earliest, index: keys.indexOf(earliest) };
}

/**
 * Update key state based on HTTP headers
 */
function recordKeyLimits(key: string, res: Response) {
  const now = Date.now();
  const existing = keyStore.get(key) || {
    key,
    cooldownUntil: 0,
    remainingRequests: 1000,
    remainingTokens: 8000,
    lastResetRequests: "0s",
    lastResetTokens: "0s",
    totalCalls: 0,
    failCount: 0,
  };

  existing.totalCalls += 1;

  const remReq = res.headers.get("x-ratelimit-remaining-requests");
  const remTok = res.headers.get("x-ratelimit-remaining-tokens");
  const resetReq = res.headers.get("x-ratelimit-reset-requests");
  const resetTok = res.headers.get("x-ratelimit-reset-tokens");

  if (remReq) existing.remainingRequests = parseInt(remReq, 10);
  if (remTok) existing.remainingTokens = parseInt(remTok, 10);
  if (resetReq) existing.lastResetRequests = resetReq;
  if (resetTok) existing.lastResetTokens = resetTok;

  if (res.status === 429) {
    existing.failCount += 1;
    const retryAfter = res.headers.get("retry-after");
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    existing.cooldownUntil = now + (Number.isNaN(seconds) ? 60 : seconds) * 1000;
  } else if (existing.remainingRequests <= 1 || existing.remainingTokens < 300) {
    existing.cooldownUntil = now + 5000;
  }

  keyStore.set(key, existing);
}

/**
 * Fetch available audit models dynamically from the API without exposing backend provider
 */
export async function fetchAuditModels(): Promise<ModelOption[]> {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    return STATIC_AUDIT_MODELS;
  }

  const selectedKey = pickNextKey(keys);
  if (!selectedKey) return STATIC_AUDIT_MODELS;

  try {
    const res = await fetch(GROQ_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${selectedKey.key}`,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return STATIC_AUDIT_MODELS;
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (!data.data || !Array.isArray(data.data)) {
      return STATIC_AUDIT_MODELS;
    }

    const validChatIds = data.data
      .map((m) => m.id)
      .filter(
        (id) =>
          !id.includes("whisper") &&
          !id.includes("guard") &&
          !id.includes("orpheus") &&
          !id.includes("safeguard")
      );

    const result: ModelOption[] = [];
    for (const id of validChatIds) {
      const match = STATIC_AUDIT_MODELS.find((m) => m.id === id);
      if (match) {
        result.push(match);
      } else {
        const cleanName = id.split("/").pop()?.toUpperCase() || id;
        result.push({
          id,
          name: cleanName,
          tier: "Audit",
          description: `High-performance inference with ${cleanName}`,
        });
      }
    }

    return result.length > 0 ? result : STATIC_AUDIT_MODELS;
  } catch {
    return STATIC_AUDIT_MODELS;
  }
}

/**
 * Calls chat completions with automatic multi-key rotation and model fallback
 */
export async function callGroqChat(
  messages: GroqChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
  } = {}
): Promise<{ content: string; modelUsed: string }> {
  const keys = getAllApiKeys();

  if (keys.length === 0) {
    throw new Error("No API key defined in environment variables (GROQ_API_KEYS or GROQ_API_KEY)");
  }

  const requestedModel = options.model || DEFAULT_MODEL;
  const modelsToAttempt = [
    requestedModel,
    ...FALLBACK_MODELS_CHAIN.filter((m) => m !== requestedModel),
  ];

  let lastError: Error | null = null;

  for (const modelCandidate of modelsToAttempt) {
    for (let keyAttempt = 0; keyAttempt < keys.length; keyAttempt++) {
      const keyObj = pickNextKey(keys);
      if (!keyObj) break;

      const payload: Record<string, unknown> = {
        model: modelCandidate,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
      };

      if (options.jsonMode) {
        payload.response_format = { type: "json_object" };
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keyObj.key}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        recordKeyLimits(keyObj.key, response);

        if (response.status === 429) {
          lastError = new Error(`Key ${keyObj.index + 1} rate limited (429). Rotating key...`);
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = new Error(`API error (${response.status}): ${errText}`);
          continue;
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const content = data.choices?.[0]?.message?.content ?? "";
        return { content, modelUsed: modelCandidate };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }
  }

  throw lastError || new Error("All API keys and models exhausted");
}

/**
 * Fetch real UI file samples from public GitHub repositories
 */
async function fetchRealRepositoryFiles(
  targetUrl: string
): Promise<Array<{ path: string; content: string }>> {
  const clean = targetUrl
    .replace(/^https?:\/\/(www\.)?(github\.com\/)?/, "")
    .replace(/\/$/, "");

  if (!clean.includes("/")) return [];

  const parts = clean.split("/");
  let owner = parts[0];
  const repo = parts[1];

  // Specific canonical GitHub organization aliases
  if (owner.toLowerCase() === "shadcn") {
    owner = "shadcn-ui";
  }

  const sampleFiles: Array<{ path: string; content: string }> = [];

  try {
    // 1. Try branch 'main', fallback to 'master' or 'canary'
    const branches = ["main", "canary", "master"];
    let treeEntries: Array<{ path: string; type: string }> = [];
    let activeBranch = "main";

    for (const b of branches) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${b}?recursive=1`,
          {
            headers: {
              "User-Agent": "Datum-Agent",
              Accept: "application/vnd.github.v3+json",
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as {
            tree?: Array<{ path: string; type: string }>;
          };
          if (Array.isArray(data.tree) && data.tree.length > 0) {
            treeEntries = data.tree;
            activeBranch = b;
            break;
          }
        }
      } catch {
        // try next branch
      }
    }

    if (treeEntries.length > 0) {
      // Find representative UI components or stylesheets
      const candidates = treeEntries.filter((f) => {
        if (f.type !== "blob") return false;
        const p = f.path.toLowerCase();
        const isUi =
          p.endsWith(".tsx") ||
          p.endsWith(".jsx") ||
          p.endsWith(".vue") ||
          p.endsWith(".svelte") ||
          p.endsWith(".blade.php") ||
          p.endsWith(".html") ||
          p.endsWith(".css");
        const isComponentOrView =
          p.includes("component") ||
          p.includes("ui/") ||
          p.includes("views/") ||
          p.includes("pages/") ||
          p.includes("app/") ||
          p.includes("styles");
        return isUi && isComponentOrView && !p.includes(".test.") && !p.includes(".spec.");
      });

      // Select up to 4 real components to analyze
      const selected = candidates.slice(0, 4);

      for (const item of selected) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);
          const rawRes = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${activeBranch}/${item.path}`,
            {
              headers: { "User-Agent": "Datum-Agent" },
              signal: controller.signal,
            }
          );
          clearTimeout(timeout);

          if (rawRes.ok) {
            const rawText = await rawRes.text();
            // Truncate if file is overly huge
            sampleFiles.push({
              path: item.path,
              content: rawText.length > 3500 ? rawText.slice(0, 3500) + "\n...[truncated]" : rawText,
            });
          }
        } catch {
          // continue
        }
      }
    }
  } catch (err) {
    console.warn("Could not fetch real repo files via GitHub API:", err);
  }

  return sampleFiles;
}

/**
 * Fetch specific files by path from a GitHub repo
 */
async function fetchFilesByPaths(
  owner: string,
  repo: string,
  branch: string,
  paths: string[]
): Promise<Array<{ path: string; content: string }>> {
  const results: Array<{ path: string; content: string }> = [];

  for (const filePath of paths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
        { headers: { "User-Agent": "Datum-Agent" }, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        results.push({
          path: filePath,
          content: text.length > 2000 ? text.slice(0, 2000) + "\n...[truncated for analysis]" : text,
        });
      }
    } catch {
      // skip file on error
    }
  }

  return results;
}

/**
 * Audits code against a design system using selected model and multi-key pool
 */
export async function auditCodebaseWithGroq(
  targetUrl: string,
  options: {
    sampleFiles?: Array<{ path: string; content: string }>;
    model?: string;
    branch?: string;
    filePaths?: string[];
    fullTreeSample?: string[];
  } = {}
): Promise<AuditResult> {
  const keys = getAllApiKeys();
  const targetModel = options.model || DEFAULT_MODEL;

  if (keys.length === 0) {
    throw new Error("No Groq API key configured. Add GROQ_API_KEY to .env.local.");
  }

  const looksLikeGitHubRepo =
    targetUrl.includes("/") && !targetUrl.toLowerCase().includes("figma.com");

  let filesToAudit: Array<{ path: string; content: string }> = [];

  if (options.sampleFiles && options.sampleFiles.length > 0) {
    // Caller provided files directly
    filesToAudit = options.sampleFiles;
  } else if (looksLikeGitHubRepo && options.filePaths && options.filePaths.length > 0 && options.branch) {
    // Fetch specific paths the frontend already identified via /api/repo/tree
    const parts = targetUrl.split("/");
    const owner = parts[0] === "shadcn" ? "shadcn-ui" : parts[0];
    const repo = parts[1];
    filesToAudit = await fetchFilesByPaths(owner, repo, options.branch, options.filePaths);
  } else if (looksLikeGitHubRepo) {
    // Fallback: discover files ourselves
    filesToAudit = await fetchRealRepositoryFiles(targetUrl);
  }

  // Repo not found — stop here
  if (looksLikeGitHubRepo && filesToAudit.length === 0) {
    throw new Error(
      `Repository "${targetUrl}" could not be accessed on GitHub. It may not exist, be private, or be empty.`
    );
  }

  const stack = await detectRepositoryStack(
    targetUrl,
    filesToAudit.map((f) => f.path)
  );

  // Budget files sent to the model to stay well within Groq message length limits:
  // Compact tree listing and pack files up to a safe 24,000 character payload limit
  const compactTree = options.fullTreeSample && options.fullTreeSample.length > 0
    ? `\nKey repository files (${Math.min(40, options.fullTreeSample.length)}):\n${options.fullTreeSample.slice(0, 40).join("\n")}\n`
    : "";

  const systemPrompt = `You are Datum, an expert design system code auditor.
Repository: "${targetUrl}"
Stack: ${stack.ecosystem} · ${stack.language} · ${stack.stylingSystem}
${compactTree}
TASK: Audit the provided source files for design system drift.
Look ONLY at actual code in the files provided. Report ONLY real violations you see in the code.

Look for:
1. Arbitrary spacing (e.g. p-[13px], style={{ padding: '13px' }}) — suggest token (e.g. p-3 = 12px)
2. Hardcoded hex colors (e.g. #3b82f7) — suggest CSS variable (e.g. var(--brand-500))
3. Arbitrary border radius (e.g. rounded-[7px]) — suggest scale value (e.g. rounded-md = 6px)
4. Non-scale font sizes, widths, gaps

IMPORTANT: Every deviation MUST have ALL these fields populated with real values from the code:
- "file": exact file path from the files provided
- "line": actual line number in that file
- "currentValue": the EXACT problematic class or value found in the code (e.g. "p-[13px]", "#3b82f7")
- "suggestedToken": the design token name to use instead (e.g. "p-3", "var(--brand-500)", "rounded-md")  
- "suggestedValue": the resolved value of that token (e.g. "12px", "#3b82f6", "6px")
- "delta": the difference (e.g. "+1px", "1.4 dE", "-2px")
- "confidence": integer between 88 and 98

Do NOT return deviations with empty strings for any field. If you can't find a specific violation in the code, do not include it.

Return ONLY valid JSON:
{
  "driftScore": number 0-100,
  "totalFilesScanned": ${filesToAudit.length},
  "totalDeviations": number,
  "summary": string,
  "deviations": [ { "file": string, "line": number, "currentValue": string, "suggestedToken": string, "suggestedValue": string, "delta": string, "confidence": number } ]
}`;

  // Assemble files within a strict 22,000 char budget to ensure messages fit comfortable in limits
  let budgetRemaining = 22000;
  const filesIncluded: Array<{ path: string; content: string }> = [];

  for (const f of filesToAudit) {
    if (budgetRemaining <= 500) break;
    const sliceLen = Math.min(f.content.length, Math.min(budgetRemaining - 100, 1500));
    const contentSlice = f.content.length > sliceLen ? f.content.slice(0, sliceLen) + "\n...[truncated]" : f.content;
    filesIncluded.push({ path: f.path, content: contentSlice });
    budgetRemaining -= contentSlice.length + 50;
  }

  const filesPrompt =
    `Here are the surveyed source files from ${targetUrl} to audit:\n\n` +
    filesIncluded
      .map((f) => `=== FILE: ${f.path} ===\n${f.content}`)
      .join("\n\n---\n\n");

  try {
    const { content: rawJson, modelUsed } = await callGroqChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: filesPrompt },
      ],
      { model: targetModel, jsonMode: true, temperature: 0.1 }
    );

    const parsed = JSON.parse(rawJson) as Partial<AuditResult>;

    // Filter deviations — only keep ones with all required fields populated
    const rawDeviations = Array.isArray(parsed.deviations) ? parsed.deviations : [];
    const validDeviations = rawDeviations.filter(
      (d) =>
        d.file &&
        typeof d.line === "number" &&
        d.currentValue &&
        d.currentValue.trim() !== "" &&
        d.suggestedToken &&
        d.suggestedToken.trim() !== "" &&
        d.suggestedValue &&
        d.suggestedValue.trim() !== "" &&
        d.delta !== undefined &&
        String(d.delta).trim() !== "" &&
        typeof d.confidence === "number" &&
        !isNaN(d.confidence)
    );

    // Compute driftScore deterministically based on real deviations found:
    // If 0 deviations, drift is strictly 0.
    // Otherwise, calculate proportionally based on deviations vs files scanned.
    const totalDevs = validDeviations.length;
    let drift = 0;
    if (totalDevs > 0) {
      // Base score on deviations density + severity, capped at 100
      const deviationsPerFile = totalDevs / Math.max(1, filesToAudit.length);
      const calculated = Math.round(Math.min(100, Math.max(10, deviationsPerFile * 25 + totalDevs * 4)));
      drift = typeof parsed.driftScore === "number" && !isNaN(parsed.driftScore) && parsed.driftScore > 0
        ? Math.min(100, Math.max(calculated, parsed.driftScore))
        : calculated;
    }

    return {
      source: targetUrl,
      modelUsed,
      stack,
      driftScore: drift,
      totalFilesScanned: filesToAudit.length,
      totalDeviations: totalDevs,
      summary:
        parsed.summary?.trim() ||
        (totalDevs === 0
          ? "No design deviations detected. Tokens are in full alignment!"
          : `${totalDevs} deviation${totalDevs === 1 ? "" : "s"} detected across ${filesToAudit.length} UI files.`),
      deviations: validDeviations,
    };
  } catch (err) {
    throw err;
  }
}

