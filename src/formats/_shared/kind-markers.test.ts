/** Regression coverage for the kind-markers predicates owned beside this file. */
import { expect, test } from "bun:test";
import { looksLikeLibraryWrapper, looksLikeSettingsExport } from "./kind-markers";

test("looksLikeSettingsExport spots preset and template grammars", () => {
  expect(looksLikeSettingsExport({ temperature: 1, prompts: [], prompt_order: [] })).toBe(true);
  expect(looksLikeSettingsExport({ input_sequence: "<|user|>", output_sequence: "x" })).toBe(true);
  expect(looksLikeSettingsExport({ story_string: "{{system}}" })).toBe(true);
});

test("looksLikeSettingsExport stays quiet on cards, books, and garbage", () => {
  expect(looksLikeSettingsExport({ name: "A", first_mes: "hi" })).toBe(false);
  expect(looksLikeSettingsExport({ name: "W", entries: {} })).toBe(false);
  expect(looksLikeSettingsExport(null)).toBe(false);
  expect(looksLikeSettingsExport([1])).toBe(false);
});

test("looksLikeLibraryWrapper needs type + exportedAt + object data", () => {
  expect(looksLikeLibraryWrapper({ exportedAt: "t", type: "preset", version: "1.0", data: {} })).toBe(true);
  expect(looksLikeLibraryWrapper({ type: "preset", data: {} })).toBe(false);
  expect(looksLikeLibraryWrapper({ exportedAt: "t", type: "preset", data: [] })).toBe(false);
});
