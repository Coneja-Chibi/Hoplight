/**
 * The seam between a preset codec's escrow and the macro layer's authoring lens.
 *
 * WHY THIS FILE EXISTS AT ALL. `sourceProfileOf` reads the escrow keys a codec wrote and answers
 * "which engine's dialect was this authored in?". Everything downstream hangs off that answer: a
 * null means `convertStoredPiece` skips macro translation entirely and emits RoleCall syntax under a
 * SillyTavern filename. The unit tests beside `sourceProfileOf` passed while it returned null for
 * three of the four codecs, because they asserted against hand-built escrow shapes rather than
 * escrow a codec actually wrote. Hand-built input cannot catch a disagreement about what the real
 * input looks like, so this suite runs the codecs.
 *
 * These are deliberately at the top level, not beside the macro layer: `src/core` must not import
 * `src/formats`, and the invariant is about the two of them agreeing.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import rolecallPreset from "./formats/rolecall/preset";
import sillytavernPreset from "./formats/sillytavern/preset";
import marinaraPreset from "./formats/marinara/preset";
import lumiversePreset from "./formats/lumiverse/preset";
import { sourceProfileOf } from "./core/preset/macros/transfer-check";
import type { PresetAdapter } from "./core/adapter";
import type { PresetWriteForProfile } from "./core/preset/capabilities";

const sample = (rel: string): { text: string; filename: string } => {
  const path = join(import.meta.dir, "..", "samples", rel);
  return { text: readFileSync(path, "utf8"), filename: rel.split("/").pop()! };
};

/**
 * Lumiverse ships no committed preset sample, so its wrapper is inlined at the minimum its own
 * detector accepts. Every other engine parses the real file.
 */
const LUMIVERSE_WRAPPER = JSON.stringify({
  type: "lumiverse_preset",
  schemaVersion: 2,
  preset: {
    id: "lp-1",
    name: "Dialect probe",
    blocks: [{ id: "b1", name: "Opening", content: "Hello {{char}}.", role: "system", enabled: true }],
  },
});

const CASES: { adapter: PresetAdapter; input: { text: string; filename: string }; expected: PresetWriteForProfile }[] = [
  {
    adapter: rolecallPreset,
    input: sample("rolecall/presets/spec-walk.preset.json"),
    expected: "rolecall",
  },
  {
    adapter: sillytavernPreset,
    input: sample("sillytavern/presets/plain.preset.json"),
    expected: "sillytavern",
  },
  {
    adapter: marinaraPreset,
    input: sample("marinara/presets/marinara-universal-preset-v12.marinara.json"),
    expected: "marinara",
  },
  {
    adapter: lumiversePreset,
    input: { text: LUMIVERSE_WRAPPER, filename: "probe.lumiverse.json" },
    expected: "lumiverse",
  },
];

for (const { adapter, input, expected } of CASES) {
  test(`${adapter.id}: escrow written by the codec resolves to the ${expected} dialect`, () => {
    const entity = adapter.toCanonical({
      ...input,
      bytes: new TextEncoder().encode(input.text),
    });
    // Stated so a failure names the cause rather than just the symptom: the escrow key IS the
    // lookup key, and a codec that keys escrow by family name ("rolecall") must resolve exactly
    // like one that keys it by adapter id ("marinara-preset").
    expect(Object.keys(entity.original ?? {}).length).toBeGreaterThan(0);
    expect(sourceProfileOf(entity)).toBe(expected);
  });
}

test("a preset with no escrow has no source dialect to claim", () => {
  expect(sourceProfileOf({ body: { name: "from scratch" } })).toBeNull();
  expect(sourceProfileOf({})).toBeNull();
  expect(sourceProfileOf(null)).toBeNull();
});

test("an unmodeled engine's escrow stays null rather than defaulting to a lens", () => {
  expect(sourceProfileOf({ original: { risu: { raw: {} } } })).toBeNull();
});
