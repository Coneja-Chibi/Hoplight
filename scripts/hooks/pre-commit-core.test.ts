/** Regression coverage for staged pre-commit parsing and routing decisions. */
import { expect, test } from "bun:test";
import {
  needsComponentCatalog,
  needsDocsIndex,
  parseNameStatusZ,
  stagedUiTypeScript,
  type StagedPath,
} from "./pre-commit-core";

const staged = (status: string, path: string): StagedPath => ({ status, path });

test("parseNameStatusZ reads ordinary paths and keeps rename destinations", () => {
  expect(parseNameStatusZ("M\0src/a.ts\0R091\0src/old.tsx\0src/new.tsx\0D\0src/gone.ts\0")).toEqual([
    staged("M", "src/a.ts"),
    { status: "R091", path: "src/new.tsx", previousPath: "src/old.tsx" },
    staged("D", "src/gone.ts"),
  ]);
});

test("stagedUiTypeScript selects every live React surface with deterministic unique output", () => {
  expect(stagedUiTypeScript([
    staged("M", "docs/ui.md"),
    staged("D", "src/ui/apps/gone/index.tsx"),
    staged("D", "src/kit/render/gone.tsx"),
    staged("M", "src\\ui\\shell\\App.tsx"),
    staged("M", "src\\ui\\shell\\menus.ts"),
    staged("M", "src\\kit\\render\\app.tsx"),
    staged("A", "src/kit/render/notify/use-notify.ts"),
    staged("A", "src/ui/apps/new/index.tsx"),
    staged("R100", "src/ui/shell/App.tsx"),
    staged("M", "src/core/example.tsx"),
  ])).toEqual([
    "src/kit/render/app.tsx",
    "src/kit/render/notify/use-notify.ts",
    "src/ui/apps/new/index.tsx",
    "src/ui/shell/App.tsx",
    "src/ui/shell/menus.ts",
  ]);
});

test("needsComponentCatalog ignores unrelated files", () => {
  expect(needsComponentCatalog([staged("M", "docs/reference/ui.md")])).toBe(false);
  expect(needsComponentCatalog([staged("M", "src/ui/_shared/nested/widget.ts")])).toBe(false);
});

test("needsComponentCatalog includes source deletions, output, and generator changes", () => {
  expect(needsComponentCatalog([staged("D", "src/ui/components/button/index.tsx")])).toBe(true);
  expect(needsComponentCatalog([staged("A", "src/ui/apps/library/Card.tsx")])).toBe(true);
  expect(needsComponentCatalog([staged("M", "src/ui/shell/App.tsx")])).toBe(true);
  expect(needsComponentCatalog([staged("M", "src/ui/shell/App.module.css")])).toBe(true);
  expect(needsComponentCatalog([staged("M", "src/ui/_shared/widget.ts")])).toBe(true);
  expect(needsComponentCatalog([staged("D", "docs/reference/components.md")])).toBe(true);
  expect(needsComponentCatalog([staged("M", "scripts/hooks/component-catalog.ts")])).toBe(true);
  expect(needsComponentCatalog([staged("M", "scripts/hooks/catalog-lib.ts")])).toBe(true);
  expect(needsComponentCatalog([
    { status: "R100", path: "archive/Button.tsx", previousPath: "src/ui/components/button/Button.tsx" },
  ])).toBe(true);
});

test("needsDocsIndex matches the generator corpus: docs/**.md except generated/ and media/", () => {
  expect(needsDocsIndex([staged("M", "docs/guide/converting.md")])).toBe(true);
  expect(needsDocsIndex([staged("A", "docs/reference/ui.md")])).toBe(true);
  expect(needsDocsIndex([staged("D", "docs/LOCAL-NOTES.md")])).toBe(true);
  // FORMAT-SUPPORT.md is directly under docs/ and IS in the corpus; editing it must regen
  expect(needsDocsIndex([staged("M", "docs/FORMAT-SUPPORT.md")])).toBe(true);
  // a doc moved out of docs/ (rename destination outside, previous inside) still changes the index
  expect(needsDocsIndex([
    { status: "R100", path: "local-notes/LOCAL-NOTES.md", previousPath: "docs/LOCAL-NOTES.md" },
  ])).toBe(true);
  // the generator's own outputs and skipped dirs never trigger (no regen loop)
  expect(needsDocsIndex([staged("M", "docs/generated/docs-index.json")])).toBe(false);
  expect(needsDocsIndex([staged("M", "docs/media/notes.md")])).toBe(false);
  expect(needsDocsIndex([staged("M", "src/ui/receipt.ts")])).toBe(false);
});
