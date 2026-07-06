import { expect, test } from "bun:test";
import {
  addedDependencies,
  addedLinesByFile,
  declaresDependency,
  hardcodedColorLiteral,
  hasVerifiedNote,
  htmlSinkTokens,
  impureCoreTokens,
  isColorGuardedFile,
  isCoreFile,
  isShellFile,
  missingCoreSiblings,
  shellBranchHits,
  shellImportTokens,
} from "./lib";

test("hardcodedColorLiteral catches hex and color functions, ignores tokens and opt-outs", () => {
  expect(hardcodedColorLiteral("  color: #e11d48;")).toBe("#e11d48");
  expect(hardcodedColorLiteral("  border: 3px solid #000;")).toBe("#000");
  expect(hardcodedColorLiteral("  box-shadow: 3px 3px 0 rgba(0,0,0,.5);")).toBe("rgba(");
  expect(hardcodedColorLiteral("  background: hsl(210 50% 40%);")).toBe("hsl(");
  expect(hardcodedColorLiteral("  color: var(--rose);")).toBeNull(); // tokens are the point
  expect(hardcodedColorLiteral("  border-color: var(--a, var(--accent));")).toBeNull();
  expect(hardcodedColorLiteral('  { name: "X", color: "#111111" }, // hardcode-ok: brand datum')).toBeNull();
  expect(hardcodedColorLiteral("  {dirty && <span>&#9679;</span>}")).toBeNull(); // HTML entity, not a color
  expect(hardcodedColorLiteral("  <span>&#10022;</span>")).toBeNull();
});

test("isColorGuardedFile guards UI styles/components, spares definitions and color-domain files", () => {
  expect(isColorGuardedFile("src/ui/components/render-box/styles.module.css")).toBe(true);
  expect(isColorGuardedFile("src/ui/apps/workbench/Editor.tsx")).toBe(true);
  expect(isColorGuardedFile("src/ui/theme/tokens.css")).toBe(false); // token definitions live here
  expect(isColorGuardedFile("src/ui/_shared/color-math.ts")).toBe(false);
  expect(isColorGuardedFile("src/ui/_shared/platform-registry.ts")).toBe(false);
  expect(isColorGuardedFile("src/studio/signature-color.ts")).toBe(false); // not a UI file
  expect(isColorGuardedFile("design/vs-pick-11.html")).toBe(false);
});

test("htmlSinkTokens flags every banned sink in UI source", () => {
  expect(htmlSinkTokens("src/ui/apps/x/index.ts", "el.innerHTML = markup;")).toEqual(["innerHTML"]);
  expect(htmlSinkTokens("src/ui/x.tsx", "<div dangerouslySetInnerHTML={{__html: s}} />")).toEqual(["dangerouslySetInnerHTML"]);
  expect(htmlSinkTokens("src/ui/x.ts", "node.insertAdjacentHTML('beforeend', s)")).toEqual(["insertAdjacentHTML"]);
  expect(htmlSinkTokens("src/ui/x.ts", "frame.srcdoc = payload")).toEqual(["srcdoc"]);
});

test("htmlSinkTokens passes clean source, comments, and non-UI paths", () => {
  expect(htmlSinkTokens("src/ui/x.ts", "el.replaceChildren(icon(SVG));")).toEqual([]);
  expect(htmlSinkTokens("src/ui/x.ts", "// never use el.innerHTML = here")).toEqual([]);
  expect(htmlSinkTokens("src/core/adapter.ts", "el.innerHTML = markup;")).toEqual([]); // not UI scope
  expect(htmlSinkTokens("src/ui/x.test.ts", "el.innerHTML = markup;")).toEqual([]);
});

test("shellImportTokens flags shell imports from apps and setup, nowhere else", () => {
  const src = 'import { useContextMenu } from "../../shell/store";';
  expect(shellImportTokens("src/ui/apps/library/views/grid.tsx", src)).toEqual(["../../shell/store"]);
  expect(shellImportTokens("src/ui/setup/steps/theme/index.tsx", src)).toEqual(["../../shell/store"]);
  expect(shellImportTokens("src/ui/shell/App.tsx", 'import { menus } from "./store";')).toEqual([]);
  expect(shellImportTokens("src/ui/apps/library/index.tsx", 'import type { AppContext } from "../../app-contract";')).toEqual([]);
  expect(shellImportTokens("src/ui/apps/x/index.tsx", "// from '../../shell/store' in a comment")).toEqual([]);
});

test("addedDependencies ignores comma-churn re-emits of unchanged deps", () => {
  const diff = [
    "--- a/package.json",
    "+++ b/package.json",
    '-    "webview-bun": "^2.4.0"',
    '+    "webview-bun": "^2.4.0",',
    '+    "zustand": "^5.0.14"',
  ].join("\n");
  expect(addedDependencies(diff)).toEqual(["zustand"]);
});

test("addedDependencies reads only version-shaped package.json additions", () => {
  const diff = [
    "+++ b/package.json",
    '+    "react": "^19.2.5",',
    '+    "zustand": "workspace:*",',
    '+    "build": "bun run scripts/build.ts",', // a script line, not a dep
    "+++ b/src/ui/boot.ts",
    '+    "fake-pkg": "^1.0.0",', // not package.json
  ].join("\n");
  expect(addedDependencies(diff)).toEqual(["react", "zustand"]);
});

test("declaresDependency wants a per-package line with substance after the name", () => {
  const msg = "Add react\n\nNew-Dependency: react (UI layer per ADR-008)\nNew-Dependency: react-dom (pair)";
  expect(declaresDependency(msg, "react")).toBe(true);
  expect(declaresDependency(msg, "react-dom")).toBe(true);
  expect(declaresDependency(msg, "zustand")).toBe(false);
  expect(declaresDependency("New-Dependency: react", "react")).toBe(false); // bare stamp, no reason
});

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
