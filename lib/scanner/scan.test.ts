import { describe, expect, it } from "vitest";
import { computeHealthScore, scanFile } from "./scan";

const titles = (path: string, content: string) => scanFile(path, content).findings.map((f) => f.title);

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

describe("security rules", () => {
  it("flags a GitHub token", () => {
    expect(titles("src/a.ts", 'const t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";')).toContain(
      "GitHub token committed"
    );
  });

  it("flags a private key block", () => {
    expect(titles("src/key.ts", "-----BEGIN RSA PRIVATE KEY-----")).toContain("Private key committed");
  });

  it("flags disabled TLS verification", () => {
    expect(titles("src/http.ts", "const agent = new https.Agent({ rejectUnauthorized: false });")).toContain(
      "TLS verification disabled"
    );
  });

  it("flags weak hash algorithms", () => {
    expect(titles("src/hash.ts", 'crypto.createHash("md5").update(pw).digest("hex");')).toContain(
      "Weak hash algorithm"
    );
  });

  it("flags innerHTML assignment", () => {
    expect(titles("src/view.ts", "el.innerHTML = userInput;")).toContain("Unsanitised HTML injection");
  });

  it("flags SQL built by string concatenation", () => {
    expect(titles("src/db.ts", 'db.query("SELECT * FROM users WHERE id = " + id);')).toContain(
      "SQL built from string interpolation"
    );
  });

  it("flags shell exec with an interpolated string", () => {
    expect(titles("src/run.ts", "exec(`rm -rf ${dir}`);")).toContain("Shell command execution with dynamic input");
  });

  it("ignores secret-like rules in test files but still flags real key formats", () => {
    expect(titles("src/a.test.ts", "eval(x)")).toHaveLength(0);
    expect(titles("src/a.test.ts", 'const k = "AKIAABCDEFGHIJKLMNOP";')).toContain("AWS access key committed");
  });

  it("does not scan .env.example files for rules", () => {
    expect(scanFile(".env.example", 'AWS_KEY=AKIAABCDEFGHIJKLMNOP').findings).toHaveLength(0);
  });
});

describe("bug rules", () => {
  it("flags an empty catch block", () => {
    expect(titles("src/x.ts", "try { run(); } catch (e) {}")).toContain("Empty catch block swallows errors");
  });

  it("flags a debugger statement", () => {
    expect(titles("src/x.js", "debugger;")).toContain("debugger statement left in code");
  });

  it("flags @ts-ignore", () => {
    expect(titles("src/x.ts", "// @ts-ignore")).toContain("Type checking suppressed");
  });
});
