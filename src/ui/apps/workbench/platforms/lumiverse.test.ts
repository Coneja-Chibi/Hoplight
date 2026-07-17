/**
 * Lumiverse native schema smoke: registry + field paths match bare extensions bag.
 */
import { test, expect } from "bun:test";
import lumiverse from "./lumiverse";
import { nativeSchemaFor } from "./index";

test("lumiverse is registered in platforms index", () => {
  expect(nativeSchemaFor("lumiverse")).toBe(lumiverse);
});

test("lumiverse schema paths sit under sillytavern.raw.data.extensions", () => {
  const prefix = "sillytavern.raw.data.extensions";
  for (const f of lumiverse.fields) {
    expect(f.path === prefix || f.path.startsWith(`${prefix}.`)).toBe(true);
  }
  const controls = new Set(lumiverse.fields.map((f) => f.control));
  expect(controls.has("portable-lora")).toBe(true);
  expect(controls.has("raw-extensions")).toBe(true);
  // expressions live in Manage Sprites only — no main-page stub cards
  expect(controls.has("expression-map")).toBe(false);
  expect(controls.has("expression-groups")).toBe(false);
  expect(lumiverse.fields.some((f) => f.path.endsWith(".expressions"))).toBe(false);
  expect(lumiverse.fields.some((f) => f.path.endsWith(".expression_groups"))).toBe(false);
  // alternate_fields / alternate_avatars → body.variants
  expect(controls.has("alt-fields")).toBe(false);
  expect(controls.has("asset-manager")).toBe(false);
});

test("catch-all hides known product keys including sprites and alts", () => {
  const raw = lumiverse.fields.find((f) => f.control === "raw-extensions");
  expect(raw?.hide).toContain("expressions");
  expect(raw?.hide).toContain("expression_groups");
  expect(raw?.hide).toContain("lumiverse_image_gen_lora");
  expect(raw?.hide).toContain("alternate_fields");
  expect(raw?.hide).toContain("alternate_avatars");
});
