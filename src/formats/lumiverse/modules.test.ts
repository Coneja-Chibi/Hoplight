/**
 * Lumiverse modules rehydrate + path→data-URI hydrate.
 */
import { test, expect } from "bun:test";
import {
  rehydrateCardData,
  resolveAssetRef,
  hasLumiverseFingerprints,
  packModulesFromExtensions,
  isDataUri,
} from "./modules";

// 1x1 PNG
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

test("hasLumiverseFingerprints detects expressions and lora", () => {
  expect(hasLumiverseFingerprints({})).toBe(false);
  expect(hasLumiverseFingerprints({ expressions: { enabled: true } })).toBe(true);
  expect(hasLumiverseFingerprints({ lumiverse_image_gen_lora: { version: 1 } })).toBe(true);
});

test("resolveAssetRef turns archive path into data URI", () => {
  const files = { "assets/other/image/expr_neutral.png": PNG };
  const ref = resolveAssetRef("assets/other/image/expr_neutral.png", files);
  expect(isDataUri(ref)).toBe(true);
  expect(ref.startsWith("data:image/png;base64,")).toBe(true);
});

test("rehydrateCardData merges modules expressions into extensions with hydrated mappings", () => {
  const path = "assets/other/image/expr_neutral.png";
  const { data, extraAssets } = rehydrateCardData(
    { name: "X", extensions: {} },
    {
      version: 1,
      expressions: {
        enabled: true,
        defaultExpression: "neutral",
        mappings: { neutral: path },
      },
    },
    { [path]: PNG },
  );
  const ext = data.extensions as Record<string, unknown>;
  const expr = ext.expressions as { enabled: boolean; mappings: Record<string, string> };
  expect(expr.enabled).toBe(true);
  expect(isDataUri(expr.mappings.neutral!)).toBe(true);
  expect(extraAssets.some((a) => a.label === "neutral" && a.role === "emotion")).toBe(true);
});

test("rehydrateCardData: no modules sidecar, a card's own pre-embedded data URIs are both counted", () => {
  // Regression guard: a prior fix (guarding modules.expressions against double-counting on the
  // unconditional re-scan) needed the SAME guard scoped OUT of this no-modules path, since here
  // hydrateExtensionsInPlace is the ONLY place expressions ever get resolved - nothing counted these
  // already. A card whose own extensions already carry data URIs (no sidecar at all) must still
  // yield both as emotion assets, not zero.
  const dataUriA = resolveAssetRef("a.png", { "a.png": PNG });
  const dataUriB = resolveAssetRef("b.png", { "b.png": PNG });
  const { extraAssets } = rehydrateCardData(
    {
      name: "X",
      extensions: { expressions: { enabled: true, mappings: { happy: dataUriA, sad: dataUriB } } },
    },
    null,
    {},
  );
  const emotion = extraAssets.filter((a) => a.role === "emotion");
  expect(emotion).toHaveLength(2);
  expect(emotion.map((a) => a.label).sort()).toEqual(["happy", "sad"]);
});

test("rehydrateCardData: a modules sidecar's resolved expressions are counted once each, not twice", () => {
  const pathA = "assets/other/image/expr_happy.png";
  const pathB = "assets/other/image/expr_sad.png";
  const { extraAssets } = rehydrateCardData(
    { name: "X", extensions: {} },
    {
      version: 1,
      expressions: { enabled: true, defaultExpression: "happy", mappings: { happy: pathA, sad: pathB } },
    },
    { [pathA]: PNG, [pathB]: PNG },
  );
  const emotion = extraAssets.filter((a) => a.role === "emotion");
  expect(emotion).toHaveLength(2);
  expect(emotion.map((a) => a.label).sort()).toEqual(["happy", "sad"]);
});

test("packModulesFromExtensions writes data URIs into archive paths", () => {
  const dataUri = resolveAssetRef("assets/x.png", { "assets/x.png": PNG });
  const { modules, files } = packModulesFromExtensions(
    {
      expressions: {
        enabled: true,
        defaultExpression: "a",
        mappings: { a: dataUri },
      },
    },
    {},
  );
  expect(modules?.expressions?.mappings?.a).toMatch(/^assets\/other\/image\/expr_a\./);
  const p = modules!.expressions!.mappings!.a!;
  expect(files[p]?.length).toBeGreaterThan(0);
});
