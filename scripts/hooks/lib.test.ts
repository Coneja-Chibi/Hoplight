/** Regression coverage for the lib.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import {
  addedLinesByFile,
  hardcodedColorLiteral,
  htmlSinkTokens,
  impureCoreTokens,
  isColorGuardedFile,
  isCoreFile,
  isLineGuardedFile,
  missingCoreSiblings,
  overLineCap,
  shellImportTokens,
} from "./lib";

test("hardcodedColorLiteral catches hex and color functions, ignores tokens and opt-outs", () => {
  expect(hardcodedColorLiteral("  color: #e11d48;")).toBe("#e11d48");
  expect(hardcodedColorLiteral("  border: 3px solid #000;")).toBe("#000");
  expect(hardcodedColorLiteral("  box-shadow: 3px 3px 0 rgba(0,0,0,.5);")).toBe("rgba(0");
  expect(hardcodedColorLiteral("  background: hsl(210 50% 40%);")).toBe("hsl(2");
  expect(hardcodedColorLiteral("  const [ar, ag, ab] = rgb(a);")).toBeNull(); // helper call, not a color
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

test("isColorGuardedFile guards plain .ts under src/ui (the decks.ts blind spot), spares data payloads", () => {
  expect(isColorGuardedFile("src/ui/_shared/decks.ts")).toBe(true); // hues hid here once, never again
  expect(isColorGuardedFile("src/ui/server.ts")).toBe(true); // manifest one-offs use hardcode-ok
  expect(isColorGuardedFile("src/ui/apps/workbench/regex/regex-styles.ts")).toBe(true);
  expect(isColorGuardedFile("src/ui/app-contract.d.ts")).toBe(false); // type decls carry no styling
  expect(isColorGuardedFile("src/ui/_shared/paint.ts")).toBe(false); // paint seeds are entity data
  expect(isColorGuardedFile("src/ui/components/css-workshop/recipes/dark-glass/index.ts")).toBe(false); // recipe payloads (dir allowlist, drop-in safe)
  expect(isColorGuardedFile("src/ui/components/css-workshop/recipes/some-future-recipe/index.ts")).toBe(false);
  expect(isColorGuardedFile("src/ui/_shared/paint.test.ts")).toBe(false); // test fixtures = color data
  expect(isColorGuardedFile("src/ui/setup/wizard-core.test.ts")).toBe(false);
  expect(isColorGuardedFile("src/ui/components/css-workshop/preview.ts")).toBe(false); // sealed foreign-host mock payload
  expect(isColorGuardedFile("src/ui/apps/css-workshop/prefs.ts")).toBe(false); // starter draft users paste onto foreign hosts
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

test("isCoreFile matches only *-core.ts", () => {
  expect(isCoreFile("src/ui/follow-core.ts")).toBe(true);
  expect(isCoreFile("src/ui/apps/workbench/recents-core.ts")).toBe(true);
  expect(isCoreFile("src\\ui\\follow-core.ts")).toBe(true); // windows path
  expect(isCoreFile("src/ui/boot.ts")).toBe(false);
  expect(isCoreFile("src/ui/follow-core.test.ts")).toBe(false);
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
  const onDisk = new Set(["src/ui/follow-core.ts", "src/ui/follow-core.test.ts", "src/ui/x-core.ts"]);
  expect(missingCoreSiblings(changed, (p) => onDisk.has(p))).toEqual(["src/ui/x-core.test.ts"]);
});

test("missingCoreSiblings: a deleted core owes nothing (its test left with it)", () => {
  // deletion shows up in the changed list, but neither file is on disk anymore
  const changed = ["src/ui/gone-core.ts"];
  expect(missingCoreSiblings(changed, () => false)).toEqual([]);
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

test("isLineGuardedFile covers src/scripts source, skips decls and other trees", () => {
  expect(isLineGuardedFile("src/ui/components/slider/index.tsx")).toBe(true);
  expect(isLineGuardedFile("scripts/hooks/gate.ts")).toBe(true);
  expect(isLineGuardedFile("src/ui/apps/workbench/Editor.module.css")).toBe(true);
  expect(isLineGuardedFile("src/types/global.d.ts")).toBe(false); // type decl
  expect(isLineGuardedFile("docs/plan.md")).toBe(false); // not source
  expect(isLineGuardedFile("scripts/hooks/big-files.json")).toBe(false); // not code
});

test("overLineCap flags an unlisted file over the default and passes one under it", () => {
  expect(overLineCap("src/foo.ts", 501, {})).toContain("past the 500-line cap");
  expect(overLineCap("src/foo.ts", 500, {})).toBeNull();
  expect(overLineCap("docs/x.md", 9000, {})).toBeNull(); // not guarded, never flagged
});

test("overLineCap freezes a grandfathered file: may shrink, may not grow", () => {
  const ceilings = { "src/ui/apps/workbench/Editor.tsx": 1506 };
  expect(overLineCap("src/ui/apps/workbench/Editor.tsx", 1506, ceilings)).toBeNull(); // at ceiling
  expect(overLineCap("src/ui/apps/workbench/Editor.tsx", 1400, ceilings)).toBeNull(); // shrank
  expect(overLineCap("src/ui/apps/workbench/Editor.tsx", 1507, ceilings)).toContain("frozen ceiling of 1506");
});
