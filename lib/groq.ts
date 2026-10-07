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
 * Calls chat completions with streaming enabled, automatic multi-key rotation and model fallback
 */
export async function callGroqChatStream(
  messages: GroqChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<{ stream: ReadableStream<Uint8Array>; modelUsed: string }> {
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

      const payload = {
        model: modelCandidate,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 3000,
        stream: true,
      };

      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${keyObj.key}`,
          },
          body: JSON.stringify(payload),
        });

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

        if (!response.body) {
          lastError = new Error("Response body is empty");
          continue;
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const reader = response.body.getReader();

        let buffer = "";

        const textStream = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  return;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith(":")) continue;
                  if (trimmed === "data: [DONE]") {
                    controller.close();
                    return;
                  }
                  if (trimmed.startsWith("data: ")) {
                    const jsonStr = trimmed.slice(6);
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const delta = parsed.choices?.[0]?.delta?.content;
                      if (delta) {
                        controller.enqueue(encoder.encode(delta));
                      }
                    } catch {
                      // ignore parse error for partial or malformed chunk
                    }
                  }
                }
              }
            } catch (err) {
              controller.error(err);
            }
          },
          cancel() {
            reader.cancel();
          },
        });

        return { stream: textStream, modelUsed: modelCandidate };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
    }
  }

  throw lastError || new Error("All API keys and models exhausted");
}
