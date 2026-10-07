import { describe, expect, it } from "vitest";
import { computeHealthScore, scanFile } from "./scan";

describe("scanFile", () => {
  it("finds TODO/FIXME with exact line numbers", () => {
    const r = scanFile("src/a.ts", "const a = 1;\n// TODO: handle errors\n/* FIXME broken */\n");
    expect(r.todos).toEqual([
      { file: "src/a.ts", line: 2, text: "TODO: handle errors" },
      { file: "src/a.ts", line: 3, text: "FIXME: broken" },
    ]);
  });

  it("flags a hardcoded AWS key and ignores placeholders", () => {
    const hit = scanFile("src/c.ts", 'const k = "AKIAABCDEFGHIJKLMNOP";');
    expect(hit.findings[0]?.severity).toBe("high");
    const ph = scanFile("src/c.ts", 'const password = "your-password-here";');
    expect(ph.findings).toHaveLength(0);
  });

  it("flags eval but not method calls named eval", () => {
    expect(scanFile("a.js", "eval(input)").findings).toHaveLength(1);
    expect(scanFile("a.js", "model.eval(x)").findings).toHaveLength(0);
  });

  it("skips minified files", () => {
    expect(scanFile("dist/a.min.js", "// TODO x").todos).toHaveLength(0);
  });

  it("scores clean code 100 and risky code lower", () => {
    expect(computeHealthScore([])).toBe(100);
    const bad = scanFile("a.js", "eval(x)\nconst p = `SELECT * FROM t WHERE id=${id}`").findings;
    expect(bad.length).toBeGreaterThanOrEqual(2);
    expect(computeHealthScore(bad)).toBeLessThan(75);
  });
});
