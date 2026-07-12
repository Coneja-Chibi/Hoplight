/**
 * "Match by example" builder (example-builder.ts): slot detection from example phrases, and the
 * unicode-aware whole-word wrap on the built pattern. Faithful to RC's analyzePhrasePattern.
 */
import { describe, expect, test } from "bun:test";
import { analyzePhrasePattern, buildFromExamples } from "./example-builder";

describe("analyzePhrasePattern", () => {
  test("uniform examples produce constant + variable slots", () => {
    const a = analyzePhrasePattern(["is it raining", "did it rain", "has it rained"]);
    expect(a.slots.length).toBe(3);
    expect(a.slots[1]!.isConstant).toBe(true); // "it" is constant
    expect(a.hasPattern).toBe(true);
    expect(a.core).toContain("\\s+");
  });

  test("empty input yields an empty core", () => {
    expect(analyzePhrasePattern([]).core).toBe("");
  });
});

describe("buildFromExamples", () => {
  test("all uniform examples match the built pattern", () => {
    const examples = ["is it raining", "did it rain", "has it rained"];
    const built = buildFromExamples(examples);
    const re = new RegExp(built.pattern, built.flags);
    expect(examples.every((e) => re.test(e))).toBe(true);
    expect(built.flags).toContain("i");
  });

  test("case-insensitive by default, dropped on request", () => {
    expect(buildFromExamples(["hi there", "hi friend"]).flags).toContain("i");
    expect(buildFromExamples(["hi there", "hi friend"], { caseSensitive: true }).flags).not.toContain("i");
  });

  test("Korean examples get lookaround boundaries + u flag and match", () => {
    const examples = ["나는 강아지", "너는 강아지"];
    const built = buildFromExamples(examples);
    expect(built.flags).toContain("u");
    const re = new RegExp(built.pattern, built.flags);
    expect(examples.every((e) => re.test(e))).toBe(true);
  });

  test("empty input builds nothing", () => {
    expect(buildFromExamples([])).toMatchObject({ pattern: "", flags: "" });
  });
});
