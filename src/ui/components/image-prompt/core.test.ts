/** Regression coverage for the core.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { imagePromptToCanonical, normalizeImagePrompt } from "./core";

test("normalizeImagePrompt reads affixes and rows", () => {
  const v = normalizeImagePrompt({
    prefix: "a",
    negative: "b",
    rows: [{ label: "always", value: "solo" }],
  });
  expect(v.prefix).toBe("a");
  expect(v.negative).toBe("b");
  expect(v.rows).toEqual([{ label: "always", value: "solo" }]);
});

test("imagePromptToCanonical omits empties", () => {
  expect(imagePromptToCanonical({
    prompt: "",
    prefix: "x",
    suffix: "",
    negative: "",
    template: "",
    instructions: "",
    emotionInstructions: "",
    rows: [{ label: "", value: "" }],
  })).toEqual({ prefix: "x" });
});
