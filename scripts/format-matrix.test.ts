/** Format-matrix coverage for registry kinds, empty kinds, and CLI examples. */
import { expect, test } from "bun:test";
import { matrixKinds, renderFormatMatrix } from "./format-matrix";

const A = (id: string, kind: string): { id: string; kind: string; outputExtensions: string[]; label: string } => ({
  id,
  kind,
  outputExtensions: ["json"],
  label: id,
});

test("matrixKinds unions entity kinds with adapter kinds, known order first", () => {
  expect(matrixKinds(["character", "pack"], [A("x-preset", "preset"), A("y", "widget")])).toEqual([
    "character",
    "preset",
    "pack",
    "widget",
  ]);
});

test("every declared kind renders a section; empty kinds say (none yet)", () => {
  const adapters = [A("sillytavern", "character"), A("marinara-preset", "preset")] as never[];
  const md = renderFormatMatrix(adapters, "1", "2026-07-21", ["character", "preset", "pack"]);
  expect(md).toContain("## Characters (1)");
  expect(md).toContain("## Presets (1)");
  expect(md).toContain("`marinara-preset`");
  expect(md).toContain("## Sprite packs (0)");
  expect(md).toContain("(none yet)");
  expect(md).toContain("bun run hoplight convert");
  expect(md).toContain("`hoplight label`");
  expect(md).not.toContain("bun run vaud");
});
