/** Regression coverage for staged pre-commit parsing and routing decisions. */
import { expect, test } from "bun:test";
import { needsComponentCatalog, parseNameStatusZ, stagedUiTsx, type StagedPath } from "./pre-commit-core";

const staged = (status: string, path: string): StagedPath => ({ status, path });

test("parseNameStatusZ reads ordinary paths and keeps rename destinations", () => {
  expect(parseNameStatusZ("M\0src/a.ts\0R091\0src/old.tsx\0src/new.tsx\0D\0src/gone.ts\0")).toEqual([
    staged("M", "src/a.ts"),
    { status: "R091", path: "src/new.tsx", previousPath: "src/old.tsx" },
    staged("D", "src/gone.ts"),
  ]);
});

test("stagedUiTsx selects live UI files with deterministic unique output", () => {
  expect(stagedUiTsx([
    staged("M", "docs/ui.md"),
    staged("D", "src/ui/apps/gone/index.tsx"),
    staged("M", "src\\ui\\shell\\App.tsx"),
    staged("A", "src/ui/apps/new/index.tsx"),
    staged("R100", "src/ui/shell/App.tsx"),
    staged("M", "src/core/example.tsx"),
  ])).toEqual(["src/ui/apps/new/index.tsx", "src/ui/shell/App.tsx"]);
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
