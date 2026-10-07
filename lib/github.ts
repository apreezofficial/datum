export interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

export interface TreeEntry {
  path: string;
  size: number;
}

export interface RepoTree {
  owner: string;
  repo: string;
  branch: string;
  entries: TreeEntry[];
  /** True when GitHub truncated the recursive tree (very large repos). */
  truncated: boolean;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/** Accepts `owner/repo`, a github.com URL, or a URL ending in /tree/<branch>. */
export function parseRepoInput(input: string): RepoRef | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  const valid = /^[A-Za-z0-9_.-]+$/;
  if (!valid.test(owner) || !valid.test(repo)) return null;
  const branch = parts[2] === "tree" && parts.length > 3 ? parts.slice(3).join("/") : undefined;
  return { owner, repo, branch };
}

function headers(accept: string): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "Datum-Scanner", Accept: accept };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

async function ghJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: headers("application/vnd.github+json"),
    signal: withTimeout(60_000, signal),
  });
  if (res.status === 404) {
    throw new GitHubError("Repository not found. It may not exist, or it is private (set GITHUB_TOKEN to scan private repos).", 404);
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError("GitHub rate limit reached. Set GITHUB_TOKEN in .env.local to raise the limit.", 429);
  }
  if (!res.ok) throw new GitHubError(`GitHub API error (${res.status}).`, res.status);
  return (await res.json()) as T;
}

export async function fetchRepoTree(ref: RepoRef, signal?: AbortSignal): Promise<RepoTree> {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  let branch = ref.branch;
  if (!branch) {
    const meta = await ghJson<{ default_branch: string }>(base, signal);
    branch = meta.default_branch;
  }
  const tree = await ghJson<{
    tree: Array<{ path: string; type: string; size?: number }>;
    truncated?: boolean;
  }>(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`, signal);

  const entries = tree.tree
    .filter((e) => e.type === "blob")
    .map((e) => ({ path: e.path, size: e.size ?? 0 }));
  return { owner: ref.owner, repo: ref.repo, branch, entries, truncated: !!tree.truncated };
}

export async function fetchFileContent(
  tree: Pick<RepoTree, "owner" | "repo" | "branch">,
  path: string,
  signal?: AbortSignal
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${tree.owner}/${tree.repo}/${encodeURIComponent(tree.branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  try {
    const res = await fetch(url, { headers: headers("text/plain"), signal: withTimeout(8_000, signal) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const IGNORED_DIRS =
  /(^|\/)(node_modules|\.git|\.next|\.nuxt|\.turbo|\.cache|\.yarn|\.pnpm-store|dist|build|out|coverage|vendor|compiled|third_party|target|__pycache__|\.venv|venv|site-packages|Pods|storybook-static|__generated__|generated|__snapshots__)\//;
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|icns|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|tar|7z|rar|mp[34]|mov|wav|ogg|webm|wasm|bin|exe|dll|so|dylib|class|jar|lock|map|snap)$/i;
const LOCKFILES = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock|Cargo\.lock|poetry\.lock)$/;

/** Real code, but rarely where you want findings: tests, docs, samples, benchmarks. Skipped unless explicitly picked. */
const LOW_VALUE =
  /(^|\/)(tests?|__tests__|__mocks__|e2e|cypress|spec|specs|docs?|documentation|examples?|demos?|samples?|fixtures?|__fixtures__|benchmarks?|bench|evals?|playground)\/|\.(test|spec|stories)\.[a-z]+$/i;

export function isLowValue(path: string): boolean {
  return LOW_VALUE.test(path);
}

export const MAX_FILE_BYTES = 1_000_000;

/** Files worth reading: text/code/config, not vendored, generated or huge. */
export function isScannable(entry: TreeEntry): boolean {
  if (IGNORED_DIRS.test(entry.path) || BINARY_EXT.test(entry.path) || LOCKFILES.test(entry.path)) return false;
  return entry.size <= MAX_FILE_BYTES;
}

/** Higher = scan (and send to the model) earlier. */
export function rankFile(path: string): number {
  const p = path.toLowerCase();
  let s = 0;
  if (/\.(tsx?|jsx?|mjs|cjs|vue|svelte)$/.test(p)) s += 100;
  else if (/\.(py|go|rs|rb|php|java|kt|cs)$/.test(p)) s += 90;
  else if (/\.(env|ya?ml|toml|json|sh)$/.test(p) || p.includes(".env")) s += 50;
  else if (/\.(css|scss|html|sql)$/.test(p)) s += 40;
  else if (p.endsWith(".md")) s += 5;
  else s += 15;
  if (/(^|\/)(app|api|server|routes?|auth|middleware|lib|src)\//.test(p)) s += 40;
  if (/(auth|login|session|token|secret|password|crypto|payment|webhook|admin)/.test(p)) s += 30;
  if (/\.(test|spec)\.|(^|\/)(__tests__|tests?|fixtures?|examples?|docs?)\//.test(p)) s -= 60;
  s -= Math.max(0, p.split("/").length - 6) * 5;
  return s;
}

/** Run `worker` over `items` with bounded concurrency. */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
