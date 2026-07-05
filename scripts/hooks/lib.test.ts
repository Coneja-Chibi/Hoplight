import { expect, test } from "bun:test";
import {
  addedLinesByFile,
  hasVerifiedNote,
  impureCoreTokens,
  isCoreFile,
  isShellFile,
  missingCoreSiblings,
  shellBranchHits,
} from "./lib";

test("isCoreFile matches only *-core.ts", () => {
  expect(isCoreFile("src/ui/follow-core.ts")).toBe(true);
  expect(isCoreFile("src/ui/apps/workbench/recents-core.ts")).toBe(true);
  expect(isCoreFile("src\\ui\\follow-core.ts")).toBe(true); // windows path
  expect(isCoreFile("src/ui/boot.ts")).toBe(false);
  expect(isCoreFile("src/ui/follow-core.test.ts")).toBe(false);
});

test("isShellFile is the boot store and app index files only", () => {
  expect(isShellFile("src/ui/boot.ts")).toBe(true);
  expect(isShellFile("src/ui/apps/library/index.ts")).toBe(true);
  expect(isShellFile("src/ui/apps/workbench/recents-core.ts")).toBe(false);
  expect(isShellFile("src/ui/apps/library/index.test.ts")).toBe(false);
  expect(isShellFile("src/studio/settings-shape.ts")).toBe(false); // not under src/ui
});

test("impureCoreTokens flags effects and passes pure logic", () => {
  expect(impureCoreTokens("export const f = (n: number) => n + 1;")).toEqual([]);
  expect(impureCoreTokens("const el = document.body;")).toContain("document.");
  expect(impureCoreTokens("await fetch('/x');")).toContain("fetch(");
  expect(impureCoreTokens('import x from "bun";')).toContain('import "bun"');
  expect(impureCoreTokens("localStorage.getItem('k')")).toContain("localStorage");
});

test("impureCoreTokens ignores effect words inside comments", () => {
  expect(impureCoreTokens("// this used to read document.cookie\nexport const f = () => 1;")).toEqual([]);
  expect(impureCoreTokens("/* window.foo was here */\nexport const f = () => 1;")).toEqual([]);
});

test("missingCoreSiblings demands a test file for each changed core", () => {
  const changed = ["src/ui/follow-core.ts", "src/ui/boot.ts", "src/ui/x-core.ts"];
  const exists = (p: string): boolean => p === "src/ui/follow-core.test.ts"; // only follow has its test
  expect(missingCoreSiblings(changed, exists)).toEqual(["src/ui/x-core.test.ts"]);
});

test("missingCoreSiblings ignores the core's own test file being what changed", () => {
  const changed = ["src/ui/follow-core.test.ts"];
  expect(missingCoreSiblings(changed, () => false)).toEqual([]);
});

test("addedLinesByFile pulls the + lines per file and skips the +++ header", () => {
  const diff = [
    "diff --git a/src/ui/boot.ts b/src/ui/boot.ts",
    "--- a/src/ui/boot.ts",
    "+++ b/src/ui/boot.ts",
    "@@ -1,2 +1,3 @@",
    " context line",
    "+const added = 1;",
    "-const removed = 2;",
  ].join("\n");
  expect(addedLinesByFile(diff).get("src/ui/boot.ts")).toEqual(["const added = 1;"]);
});

test("shellBranchHits catches a new branch added to a shell file", () => {
  const diff = [
    "+++ b/src/ui/boot.ts",
    "+  if (onWorkbench()) return;",
    "+  const x = 1;",
  ].join("\n");
  const hits = shellBranchHits(diff);
  expect(hits.length).toBe(1);
  expect(hits[0]!.file).toBe("src/ui/boot.ts");
});

test("shellBranchHits ignores branches added to a core or test file", () => {
  const diff = ["+++ b/src/ui/follow-core.ts", "+  if (onWorkbench) return 'surface';"].join("\n");
  expect(shellBranchHits(diff)).toEqual([]);
});

test("shellBranchHits does not fire on non-branch added lines", () => {
  const diff = ["+++ b/src/ui/boot.ts", "+  const notified = true; // if only"].join("\n");
  expect(shellBranchHits(diff)).toEqual([]);
});

test("hasVerifiedNote accepts an explicit note and rejects an empty stamp", () => {
  expect(hasVerifiedNote("Fix thing\n\nVerified: clicked the card, no dialog")).toBe(true);
  expect(hasVerifiedNote("Fix thing\n\nTested: bun test green + manual")).toBe(true);
  expect(hasVerifiedNote("Fix thing")).toBe(false);
  expect(hasVerifiedNote("Verified:")).toBe(false); // bare stamp, nothing after
});
