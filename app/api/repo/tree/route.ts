import { NextResponse } from "next/server";

function scoreFile(path: string): number {
  const p = path.toLowerCase();

  // Hidden dot-directories get a penalty so internal agent/ci configs aren't prioritized
  if (p.startsWith(".") || p.includes("/.")) {
    return -1000;
  }

  // Build, vendor, test, generated files penalty
  if (
    p.includes("node_modules/") ||
    p.includes("dist/") ||
    p.includes("build/") ||
    p.includes("coverage/") ||
    p.includes("vendor/") ||
    p.includes("__tests__/") ||
    p.includes("/fixtures/") ||
    p.includes("/examples/")
  ) {
    return -500;
  }

  let score = 0;

  // Primary source code extensions
  if (p.endsWith(".tsx") || p.endsWith(".jsx")) score += 100;
  else if (p.endsWith(".ts") || p.endsWith(".js") || p.endsWith(".mjs")) score += 90;
  else if (p.endsWith(".py") || p.endsWith(".go") || p.endsWith(".rs")) score += 85;
  else if (p.endsWith(".vue") || p.endsWith(".svelte")) score += 85;
  else if (p.endsWith(".css") || p.endsWith(".scss")) score += 70;
  else if (p.endsWith(".json") && (p.includes("package.json") || p.includes("tsconfig.json"))) score += 60;
  else if (p.endsWith(".toml") || p.endsWith(".yaml") || p.endsWith(".yml")) score += 40;
  else if (p.endsWith(".md")) score += 15;
  else score += 20;

  // Key application directories across monorepos and standard repos
  if (p.includes("packages/next/") || p.includes("packages/core/")) score += 80;
  if (p.startsWith("src/") || p.includes("/src/")) score += 60;
  if (p.startsWith("app/") || p.includes("/app/")) score += 60;
  if (p.includes("components/") || p.includes("/components/")) score += 55;
  if (p.includes("lib/") || p.includes("/lib/")) score += 50;
  if (p.includes("server/") || p.includes("/server/")) score += 45;
  if (p.includes("core/") || p.includes("/core/")) score += 45;
  if (p.includes("api/") || p.includes("/api/")) score += 40;
  if (p.includes("pages/") || p.includes("/pages/")) score += 40;

  // Penalize tests
  if (p.includes(".test.") || p.includes(".spec.")) score -= 50;

  // Penalize overly deep nesting
  const depth = path.split("/").length;
  if (depth > 6) score -= (depth - 6) * 5;

  return score;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");

  if (!repo || !repo.includes("/")) {
    return NextResponse.json(
      { success: false, error: "Invalid repo format. Use owner/repo." },
      { status: 400 }
    );
  }

  const parts = repo.split("/");
  const owner = parts[0] === "shadcn" ? "shadcn-ui" : parts[0];
  const repoName = parts[1];

  const branches = ["main", "canary", "master"];

  for (const branch of branches) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`,
        {
          headers: {
            "User-Agent": "Datum-Agent",
            Accept: "application/vnd.github.v3+json",
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = (await res.json()) as {
        tree?: Array<{ path: string; type: string }>;
      };

      if (!Array.isArray(data.tree) || data.tree.length === 0) continue;

      const allFiles = data.tree
        .filter((f) => f.type === "blob")
        .map((f) => f.path);

      // Exclude build artifacts and lockfiles
      const ignoredDirPrefixes = [
        "node_modules/",
        ".git/",
        ".next/",
        "dist/",
        "build/",
        "out/",
        "coverage/",
        "vendor/",
      ];

      const codeFiles = allFiles.filter((p) => {
        const lower = p.toLowerCase();
        return !ignoredDirPrefixes.some((prefix) => lower.startsWith(prefix) || lower.includes("/" + prefix));
      });

      // Match meaningful code and configuration files across the entire codebase
      const sourceFiles = codeFiles.filter((path) => {
        const p = path.toLowerCase();
        const isBinaryOrAsset =
          p.endsWith(".png") ||
          p.endsWith(".jpg") ||
          p.endsWith(".jpeg") ||
          p.endsWith(".gif") ||
          p.endsWith(".svg") ||
          p.endsWith(".ico") ||
          p.endsWith(".woff") ||
          p.endsWith(".woff2") ||
          p.endsWith(".ttf") ||
          p.endsWith(".lock") ||
          p.endsWith("package-lock.json") ||
          p.endsWith("pnpm-lock.yaml");

        return !isBinaryOrAsset;
      });

      // Extract meaningful source folders across code files
      const allFolders = Array.from(
        new Set(
          codeFiles
            .map((p) => {
              const lastSlash = p.lastIndexOf("/");
              return lastSlash > -1 ? p.substring(0, lastSlash) : "root";
            })
            .filter((folder) => folder !== "root" && !folder.startsWith("."))
        )
      );

      // Score and rank all source files so real code is prioritized over hidden configs or docs
      const sortedSourceFiles = [...sourceFiles].sort((a, b) => scoreFile(b) - scoreFile(a));

      // Separate high-scoring files (score > 0)
      const primaryFiles = sortedSourceFiles.filter((p) => scoreFile(p) > 0);
      const allRankedFiles = primaryFiles.length > 0 ? primaryFiles : sortedSourceFiles;

      return NextResponse.json({
        success: true,
        data: {
          owner,
          repo: repoName,
          branch,
          totalFiles: allFiles.length,
          allUiFilesCount: sourceFiles.length,
          allFolders,
          uiFilesToRead: allRankedFiles.slice(0, 1000),
          fullTreeSample: sortedSourceFiles.slice(0, 300),
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    {
      success: false,
      error: `Repository "${repo}" could not be accessed on GitHub. It may not exist or be private.`,
    },
    { status: 404 }
  );
}
