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

      // Filter for UI-relevant files
      const uiFiles = allFiles.filter((path) => {
        const p = path.toLowerCase();
        const isUiExt =
          p.endsWith(".tsx") ||
          p.endsWith(".jsx") ||
          p.endsWith(".vue") ||
          p.endsWith(".svelte") ||
          p.endsWith(".html") ||
          p.endsWith(".css");
        const isComponentOrView =
          p.includes("component") ||
          p.includes("ui/") ||
          p.includes("views/") ||
          p.includes("pages/") ||
          p.includes("app/") ||
          p.includes("styles") ||
          p.includes("layout");
        return (
          isUiExt &&
          isComponentOrView &&
          !p.includes(".test.") &&
          !p.includes(".spec.") &&
          !p.includes(".stories.")
        );
      });

      return NextResponse.json({
        success: true,
        data: {
          owner,
          repo: repoName,
          branch,
          totalFiles: allFiles.length,
          allUiFilesCount: uiFiles.length,
          // Top 6 UI files to deeply read and audit
          uiFilesToRead: uiFiles.slice(0, 6),
          // Full tree listing (paths only) — sent to AI as context
          fullTreeSample: allFiles.slice(0, 120),
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
