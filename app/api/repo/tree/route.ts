import { NextResponse } from "next/server";

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

      // Exclude junk / non-code / internal tooling directories
      const ignoredDirPrefixes = [
        "node_modules/",
        ".git/",
        ".github/",
        ".next/",
        ".vscode/",
        "dist/",
        "build/",
        "out/",
        "coverage/",
        "public/",
        "vendor/",
      ];

      const codeFiles = allFiles.filter((p) => {
        const lower = p.toLowerCase();
        return !ignoredDirPrefixes.some((prefix) => lower.startsWith(prefix) || lower.includes("/" + prefix));
      });

      // Match all UI components, views, layouts, and style files anywhere in the repo (including src/)
      const uiFiles = codeFiles.filter((path) => {
        const p = path.toLowerCase();
        const isUiExt =
          p.endsWith(".tsx") ||
          p.endsWith(".jsx") ||
          p.endsWith(".vue") ||
          p.endsWith(".svelte") ||
          p.endsWith(".blade.php") ||
          p.endsWith(".html") ||
          p.endsWith(".css") ||
          p.endsWith(".scss");

        const isTestOrConfig =
          p.includes(".test.") ||
          p.includes(".spec.") ||
          p.includes(".stories.") ||
          p.includes("tailwind.config") ||
          p.includes("postcss.config");

        return isUiExt && !isTestOrConfig;
      });

      // Extract meaningful source folders across code files (e.g. src/components, app, etc.)
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

      // Return ALL UI files for full codebase scanning (up to 35 for thorough deep scan)
      const uiFilesToRead = uiFiles.length > 0 ? uiFiles.slice(0, 35) : allFiles.filter((p) => p.endsWith(".html") || p.endsWith(".css")).slice(0, 35);

      return NextResponse.json({
        success: true,
        data: {
          owner,
          repo: repoName,
          branch,
          totalFiles: allFiles.length,
          allUiFilesCount: uiFiles.length,
          allFolders,
          uiFilesToRead,
          fullTreeSample: allFiles.slice(0, 200),
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
