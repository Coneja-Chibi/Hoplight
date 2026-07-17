/**
 * Plain-English trigger summaries.
 */
import { test, expect } from "bun:test";
import { summarizeCondition, summarizeEffect, summarizeRecipe, summarizeTrigger } from "./explain";
import { recipeById } from "./recipes";

test("summarizeCondition known row", () => {
  expect(summarizeCondition({ type: "var", var: "hp", operator: ">", value: "0" })).toBe(
    "hp is greater than 0",
  );
});

test("summarizeCondition advanced is null", () => {
  expect(summarizeCondition({ type: "value", var: "{{getvar::x}}", operator: "=", value: "1" })).toBeNull();
});

test("summarizeEffect setvar and impersonate", () => {
  expect(summarizeEffect({ type: "setvar", var: "hp", operator: "-=", value: "10" })).toBe(
    "hp subtract 10",
  );
  expect(summarizeEffect({ type: "impersonate", role: "char", value: "hi" })).toBe(
    'speak as the character: hi',
  );
});

test("summarizeTrigger structured rule", () => {
  const text = summarizeTrigger({
    label: "hurt costs HP",
    event: "output",
    conditions: [{ type: "var", var: "status", operator: "=", value: "Hurt" }],
    effects: [{ type: "setvar", var: "hp", operator: "-=", value: "10" }],
  });
  expect(text).toContain("hurt costs HP");
  expect(text).toContain("after the model replies");
  expect(text).toContain("status is Hurt");
  expect(text).toContain("hp subtract 10");
});

test("summarizeRecipe includes seed vars", () => {
  const recipe = recipeById("hp-hurt")!;
  const text = summarizeRecipe(recipe);
  expect(text).toContain("Seeds variables");
  expect(text).toContain("hp=");
  expect(text).toContain("status=");
});
