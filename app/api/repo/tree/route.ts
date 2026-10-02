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

      // Exclude only purely generated build artifacts and lockfiles
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

      // Match all meaningful code and configuration files across the entire codebase
      const sourceFiles = codeFiles.filter((path) => {
        const p = path.toLowerCase();
        // Ignore binaries, images, fonts, lockfiles
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

      // Return representative source files across the codebase (up to 40 for thorough inspection)
      const filesToInspect = sourceFiles.slice(0, 40);

      return NextResponse.json({
        success: true,
        data: {
          owner,
          repo: repoName,
          branch,
          totalFiles: allFiles.length,
          allUiFilesCount: sourceFiles.length,
          allFolders,
          uiFilesToRead: filesToInspect,
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
