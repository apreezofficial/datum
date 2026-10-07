import { describe, expect, it } from "vitest";
import { groupFolders, inFolders } from "./folders";

describe("groupFolders", () => {
  const files = [
    "README.md",
    ...Array.from({ length: 5 }, (_, i) => `packages/a/src/f${i}.ts`),
    ...Array.from({ length: 4 }, (_, i) => `packages/b/f${i}.ts`),
    "packages/index.ts",
    "docs/x.md",
  ];

  it("expands folders bigger than the limit into children", () => {
    const g = groupFolders(files, 6);
    expect(g.map((x) => x.path)).toEqual(
      expect.arrayContaining(["", "docs", "packages/a", "packages/b", "packages/*"])
    );
    expect(g.find((x) => x.path === "packages/a")?.files).toBe(5);
  });

  it("every file belongs to exactly one group", () => {
    const g = groupFolders(files, 6);
    for (const f of files) {
      expect(g.filter((x) => inFolders(f, [x.path]))).toHaveLength(1);
    }
  });
});
