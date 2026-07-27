/**
 * Real presets must import, not be called corrupt.
 *
 * THE REGRESSION THIS PINS. Between 0.1.14 and 0.1.19 the preset body gained a strict decoder over
 * every settings group; before that only four fields were checked and samplers, behavior and API
 * options were not validated at all. The codec copies wire values verbatim, so a preset carrying
 * `"temperature": "1.0"` - which SillyTavern preserves forever, because it stores and re-exports
 * values without ever normalising them - went from loading fine to "corrupt entity file". Re-
 * exporting from ST did not help: it hands back the same types it was given.
 *
 * The fix converts at the boundary rather than relaxing the decoder, so a typo in Hoplight's OWN
 * writer is still a loud failure. That is the line these tests hold: real drifted data loads,
 * genuinely ambiguous data is still refused rather than guessed at.
 */
import { describe, expect, test } from "bun:test";
import stPreset from "../sillytavern/preset";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { samplerSchema } from "../../entities/preset/runtime-schema";
import { SAMPLER_FIELDS } from "./st-preset-wire";
import type { CanonicalPreset } from "../../entities/preset/schema";

const importPreset = (raw: Record<string, unknown>): CanonicalPreset => {
  const text = JSON.stringify(raw);
  return stPreset.toCanonical({ text, bytes: new TextEncoder().encode(text), filename: "p.json" } as never);
};

/** The minimum ST shape the detector accepts, so each case varies exactly one field. */
const preset = (extra: Record<string, unknown>): Record<string, unknown> => ({
  temperature: 1,
  prompts: [{ identifier: "main", name: "Main", content: "hi", role: "system" }],
  prompt_order: [{ character_id: 100001, order: [{ identifier: "main", enabled: true }] }],
  ...extra,
});

const decodes = (raw: Record<string, unknown>): boolean => {
  try {
    parseCanonicalEntity(importPreset(raw));
    return true;
  } catch {
    return false;
  }
};

describe("values that drifted type still import", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["a numeric sampler written as text", { temperature: "1.0" }],
    ["a context size written as text", { openai_max_context: "16384" }],
    ["a seed written as text", { seed: "-1" }],
    ["a names mode written as text", { names_behavior: "1" }],
    ["a boolean written as text", { stream_openai: "true" }],
    ["a boolean written as 0 or 1", { wrap_in_quotes: 0 }],
    ["a swipe count written as text", { n: "1" }],
    ["a string field written as a number", { bias_preset_selected: 0 }],
    ["an image quality written as a number", { inline_image_quality: 2 }],
    ["an empty-send written as a number", { send_if_empty: 0 }],
  ];
  for (const [why, patch] of cases) {
    test(why, () => expect(decodes(preset(patch))).toBe(true));
  }

  test("the converted value is the real type, not merely accepted", () => {
    const body = importPreset(preset({ temperature: "1.0", stream_openai: "true", wrap_in_quotes: 0 })).body;
    expect(body.samplers?.temperature).toBe(1);
    expect(body.apiOptions?.streamResponses).toBe(true);
    expect(body.behavior?.wrapInQuotes).toBe(false);
  });
});

describe("ambiguous values are refused, never guessed", () => {
  test("an empty string does not become zero", () => {
    // Silently reading "" as 0 would invent a temperature the author never wrote. It stays as it
    // was so the decoder still reports it.
    expect(importPreset(preset({ temperature: "" })).body.samplers?.temperature).toBe("" as never);
  });

  test("unparseable text does not become a number", () => {
    expect(importPreset(preset({ seed: "soon" })).body.generation?.seed).toBe("soon" as never);
  });

  test("a word that is not true or false does not become a boolean", () => {
    expect(importPreset(preset({ stream_openai: "yes" })).body.apiOptions?.streamResponses).toBe("yes" as never);
  });

  test("a number outside 0 and 1 does not become a boolean", () => {
    expect(importPreset(preset({ wrap_in_quotes: 2 })).body.behavior?.wrapInQuotes).toBe(2 as never);
  });
});

describe("prompt post-processing reads the key SillyTavern really writes", () => {
  test("custom_prompt_post_processing is imported", () => {
    // The codec read `prompt_post_processing`, which ST has never written, so this setting was
    // silently dropped from every import.
    expect(importPreset(preset({ custom_prompt_post_processing: "merge" })).body.samplers?.promptPostProcessing)
      .toBe("merge");
  });

  test("the _tools variants survive as themselves, not folded into their plain twins", () => {
    for (const value of ["merge_tools", "semi_tools", "strict_tools"]) {
      const got = importPreset(preset({ custom_prompt_post_processing: value })).body.samplers?.promptPostProcessing;
      expect(got).toBe(value as never);
    }
  });

  test("ST's empty string for None normalizes to none", () => {
    expect(importPreset(preset({ custom_prompt_post_processing: "" })).body.samplers?.promptPostProcessing)
      .toBe("none");
  });

  test("every one of these decodes, which is what broke before", () => {
    for (const v of ["", "merge", "merge_tools", "semi", "semi_tools", "strict", "strict_tools", "single", "claude"]) {
      expect(decodes(preset({ custom_prompt_post_processing: v }))).toBe(true);
    }
  });
});

test("the field table and the decoder agree on every sampler key", () => {
  // Coercion reads expected types off the schema precisely so the two cannot drift. If a canonical
  // key in the table stops existing in the shape, coercion silently stops applying to it.
  const shape = (samplerSchema as unknown as { def: { shape: Record<string, unknown> } }).def.shape;
  for (const [, canonical] of SAMPLER_FIELDS) {
    expect(Object.keys(shape)).toContain(canonical);
  }
});
