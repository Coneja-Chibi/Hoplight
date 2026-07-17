/**
 * setSampler and the Round-Trip Law: absent must stay absent. A settings panel that writes 0 (or an
 * empty {}) into a preset that never carried the field would emit values the source never had.
 */
import { describe, expect, test } from "bun:test";
import { setSampler } from "./session";
import type { PresetBody } from "../../../../entities/preset";

const base = (): PresetBody => ({ name: "P", prompts: [] });

describe("setSampler", () => {
  test("sets a value, creating the samplers object", () => {
    expect(setSampler(base(), "temperature", 0.8).samplers?.temperature).toBe(0.8);
  });

  test("0 is a real value, not an absence", () => {
    const b = setSampler(base(), "temperature", 0);
    expect(b.samplers?.temperature).toBe(0);
    expect("temperature" in (b.samplers as object)).toBe(true);
  });

  test("undefined REMOVES the key rather than writing 0", () => {
    const withVal = setSampler(base(), "topP", 0.9);
    expect(setSampler(withVal, "topP", undefined).samplers).toBeUndefined();
  });

  test('an empty input ("") clears, never becomes 0', () => {
    const withVal = setSampler(base(), "topK", 40);
    expect(setSampler(withVal, "topK", "").samplers).toBeUndefined();
  });

  test("clearing one key keeps the others", () => {
    let b = setSampler(base(), "temperature", 1);
    b = setSampler(b, "topP", 0.9);
    b = setSampler(b, "topP", undefined);
    expect(b.samplers).toEqual({ temperature: 1 });
  });

  test("a preset that never had samplers does not gain an empty object", () => {
    const b = setSampler(base(), "minP", undefined);
    expect("samplers" in b).toBe(false);
  });

  test("never mutates the input body", () => {
    const original = base();
    setSampler(original, "temperature", 0.5);
    expect(original.samplers).toBeUndefined();
  });

  test("leaves sibling sections intact", () => {
    const withOther: PresetBody = { ...base(), behavior: { wrapInQuotes: true } };
    const b = setSampler(withOther, "temperature", 1);
    expect(b.behavior).toEqual({ wrapInQuotes: true });
    const cleared = setSampler(b, "temperature", undefined);
    expect(cleared.behavior).toEqual({ wrapInQuotes: true });
    expect(cleared.samplers).toBeUndefined();
  });
});
