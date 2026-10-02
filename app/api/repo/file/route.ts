import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const branch = searchParams.get("branch") || "main";

  if (!repo || !path) {
    return NextResponse.json({ success: false, error: "Missing repo or path" }, { status: 400 });
  }

  const parts = repo.split("/");
  const owner = parts[0] === "shadcn" ? "shadcn-ui" : parts[0];
  const repoName = parts[1];

  const branches = [branch, "main", "master", "canary"];

  for (const b of branches) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repoName}/${b}/${path}`,
        { headers: { "User-Agent": "Datum-Agent" }, signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        return NextResponse.json({
          success: true,
          data: {
            path,
            content: text,
            branch: b,
          },
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
}
