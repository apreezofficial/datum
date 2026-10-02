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
 * Audits code against a design system using selected model and multi-key pool
 */
export async function auditCodebaseWithGroq(
  targetUrl: string,
  sampleFiles?: Array<{ path: string; content: string }>,
  preferredModel?: string
): Promise<AuditResult> {
  const keys = getAllApiKeys();
  const targetModel = preferredModel || DEFAULT_MODEL;

  if (keys.length === 0) {
    throw new Error("No Groq API key configured. Add GROQ_API_KEY to .env.local.");
  }

  // If caller didn't provide files, attempt to fetch real live files from GitHub
  let filesToAudit = sampleFiles && sampleFiles.length > 0 ? sampleFiles : [];
  const repoExists = targetUrl.includes("/");

  if (filesToAudit.length === 0 && !targetUrl.toLowerCase().includes("figma.com") && repoExists) {
    filesToAudit = await fetchRealRepositoryFiles(targetUrl);
  }

  // If the repo doesn't exist / GitHub returned nothing and it looks like a real repo path, flag it
  const looksLikeGitHubRepo = repoExists && !targetUrl.toLowerCase().includes("figma.com");
  const repoNotFound = looksLikeGitHubRepo && filesToAudit.length === 0;

  const stack = await detectRepositoryStack(
    targetUrl,
    filesToAudit.map((f) => f.path)
  );

  const systemPrompt = `You are Datum, an automated design system code auditor.
The target repository is "${targetUrl}".
Stack:
- Ecosystem: ${stack.ecosystem} (${stack.language})
- Manifest: ${stack.manifestName}
- Styling System: ${stack.stylingSystem}

${repoNotFound ? `NOTE: The repository "${targetUrl}" could not be fetched from GitHub (it may be private, non-existent, or empty). You MUST respond with an empty deviations array and driftScore of 0.` : ""}

Your objective:
Conduct a rigorous audit of design system drift and token non-conformance.
Look for:
1. Arbitrary non-token spacing/padding/margins (e.g. p-[13px], mt-[22px], style={{ padding: '13px' }} instead of p-3 (12px), p-3.5 (14px), mt-5 (20px))
2. Hardcoded hex colors (e.g. #3b82f7, #e5e7eb instead of semantic tokens like var(--brand-500) (#3b82f6), border-gray-200)
3. Non-scale arbitrary border radii (e.g. rounded-[7px] instead of rounded-md (6px))
4. Inconsistent sizing or border widths (e.g. border-[1.5px])

Return ONLY a valid JSON object matching this schema:
{
  "driftScore": number (0 if repo not found, otherwise 15 to 75),
  "totalFilesScanned": number,
  "totalDeviations": number,
  "summary": string,
  "repoFound": boolean (false if repository could not be fetched),
  "deviations": []
}

${repoNotFound ? 'Since the repository was not found, return: {"driftScore":0,"totalFilesScanned":0,"totalDeviations":0,"summary":"Repository not found or inaccessible.","repoFound":false,"deviations":[]}' : "Provide at least 3-6 specific high-confidence deviations from the actual source files."}`;

  const filesPrompt =
    filesToAudit.length > 0
      ? `Audit these actual source files fetched from ${targetUrl}:\n\n` +
        filesToAudit
          .map((f) => `=== FILE: ${f.path} ===\n${f.content}`)
          .join("\n\n")
      : `Audit repository ${targetUrl}. Analyze its key UI components, layout templates, and styling tokens for deviations against standard design tokens.`;


  try {
    const { content: rawJson, modelUsed } = await callGroqChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: filesPrompt },
      ],
      { model: targetModel, jsonMode: true, temperature: 0.2 }
    );

    const parsed = JSON.parse(rawJson) as Partial<AuditResult> & { repoFound?: boolean };

    // Real deviations only — never inject fake ones
    const validDeviations = Array.isArray(parsed.deviations) ? parsed.deviations : [];

    const drift = typeof parsed.driftScore === "number" ? parsed.driftScore : 0;
    const totalDevs = typeof parsed.totalDeviations === "number" ? parsed.totalDeviations : validDeviations.length;

    return {
      source: targetUrl,
      modelUsed,
      stack,
      driftScore: drift,
      totalFilesScanned: parsed.totalFilesScanned ?? stack.fileCount,
      totalDeviations: totalDevs,
      summary: parsed.summary || (validDeviations.length === 0
        ? repoNotFound
          ? "Repository not found or inaccessible on GitHub."
          : "No design deviations detected. Tokens are in full alignment!"
        : `${totalDevs} deviations detected across ${parsed.totalFilesScanned ?? stack.fileCount} UI files.`),
      deviations: validDeviations,
    };
  } catch (err) {
    // Rethrow — the API route will return { success: false, error: message }
    // The frontend will see auditData = null and show the clean "no data" state
    throw err;
  }
}
