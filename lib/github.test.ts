import { describe, expect, it } from "vitest";
import { isScannable, parseRepoInput } from "./github";

describe("parseRepoInput", () => {
  it("accepts owner/repo", () => {
    expect(parseRepoInput("octo/hello")).toEqual({ owner: "octo", repo: "hello", branch: undefined });
  });

  it("accepts a github.com URL with or without protocol and .git suffix", () => {
    expect(parseRepoInput("https://github.com/octo/hello.git")).toMatchObject({ owner: "octo", repo: "hello" });
    expect(parseRepoInput("github.com/octo/hello")).toMatchObject({ owner: "octo", repo: "hello" });
    expect(parseRepoInput("www.github.com/octo/hello")).toMatchObject({ owner: "octo", repo: "hello" });
  });

  it("reads a branch from /tree/<branch>", () => {
    expect(parseRepoInput("https://github.com/octo/hello/tree/feature/x")).toEqual({
      owner: "octo",
      repo: "hello",
      branch: "feature/x",
    });
  });

  it("rejects invalid input", () => {
    expect(parseRepoInput("just-one-part")).toBeNull();
    expect(parseRepoInput("bad owner/repo")).toBeNull();
  });
});

describe("isScannable", () => {
  it("skips vendored, binary and oversized files", () => {
    expect(isScannable({ path: "node_modules/x/index.js", size: 10 })).toBe(false);
    expect(isScannable({ path: "logo.png", size: 10 })).toBe(false);
    expect(isScannable({ path: "src/huge.ts", size: 2_000_000 })).toBe(false);
  });

  it("keeps ordinary source files", () => {
    expect(isScannable({ path: "src/app.ts", size: 100 })).toBe(true);
  });
});
