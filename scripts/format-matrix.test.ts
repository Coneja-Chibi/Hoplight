/**
 * The matrix generator must be kind-BLIND-proof: every kind the studio models or any adapter
 * declares renders a section, zero-adapter kinds render an honest "(none yet)" row. The old
 * hand-partition silently hid the preset kind for weeks; this pins the fix.
 */
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
});
