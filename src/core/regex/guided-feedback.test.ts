/**
 * Guided miss feedback (guided-feedback.ts): the ONE miss chip is always engine truth - a real
 * example with an unseen word substituted in, kept ONLY when the compiled pattern truly rejects it.
 * Latin input draws the miss from the English fallback; non-Latin input stays in its own script.
 */
import { describe, expect, test } from "bun:test";
import { buildFromExamples } from "./example-builder";
import { guidedMiss } from "./guided-feedback";

const compile = (find: string, flags: string) =>
  new RegExp(find, [...new Set(flags.replace(/[gy]/g, ""))].join(""));

describe("guidedMiss", () => {
  test("Latin: builds an unseen-word miss the pattern actually rejects", () => {
    const examples = ["is it raining", "did it rain", "has it rained"];
    const built = buildFromExamples(examples);
    const miss = guidedMiss(built.pattern, built.flags, examples);
    expect(miss).not.toBeNull();
    // the miss is not one of the examples, and the pattern rejects it
    expect(examples).not.toContain(miss);
    expect(compile(built.pattern, built.flags).test(miss!)).toBe(false);
  });

  test("non-Latin: the miss stays in the input's own script", () => {
    const examples = ["나는 강아지", "너는 강아지"];
    const built = buildFromExamples(examples);
    const miss = guidedMiss(built.pattern, built.flags, examples);
    if (miss !== null) {
      // no ASCII letters leaked into a Korean miss
      expect(/[a-zA-Z]/.test(miss)).toBe(false);
      expect(compile(built.pattern, built.flags).test(miss)).toBe(false);
    }
  });

  test("returns null when no example matches the pattern (no honest miss)", () => {
    // a pattern the examples cannot satisfy -> no seed -> null
    expect(guidedMiss("^\\d{9}$", "", ["hello", "world"])).toBeNull();
  });

  test("returns null on empty examples or an invalid pattern", () => {
    expect(guidedMiss("\\bcat\\b", "i", [])).toBeNull();
    expect(guidedMiss("(", "", ["cat"])).toBeNull();
  });
});
