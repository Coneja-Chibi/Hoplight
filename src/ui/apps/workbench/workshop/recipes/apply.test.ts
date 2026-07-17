/**
 * Pure recipe apply / undo (independent of discovery).
 */
import { test, expect } from "bun:test";
import {
  applyRecipe,
  mergeRecipeVars,
  stampRecipeApply,
  undoRecipeApply,
} from "./apply";
import { listRecipes, recipeById } from "./registry";

test("applyRecipe appends without mutating source", () => {
  const base = [{ label: "keep", event: "start", conditions: [], effects: [] }];
  const recipe = listRecipes()[0]!;
  const next = applyRecipe(base, recipe);
  expect(next.length).toBe(base.length + recipe.triggers.length);
  expect(base.length).toBe(1);
  expect(next[0]?.label).toBe("keep");
});

test("mergeRecipeVars fills missing names only", () => {
  const rows = [{ name: "hp", value: "50" }];
  const recipe = recipeById("hp-hurt")!;
  const next = mergeRecipeVars(rows, recipe);
  expect(next.find((r) => r.name === "hp")?.value).toBe("50");
  expect(next.find((r) => r.name === "status")?.value).toBe("ok");
});

test("stamp + undo restores prior triggers and vars", () => {
  const recipe = listRecipes()[0]!;
  const beforeT = [{ label: "keep", event: "start", conditions: [], effects: [] }];
  const beforeV = [{ name: "x", value: "1" }];
  const snap = stampRecipeApply(recipe, beforeT, beforeV);
  const applied = applyRecipe(beforeT, recipe);
  expect(applied.length).toBeGreaterThan(beforeT.length);
  const restored = undoRecipeApply(snap);
  expect(restored.triggers).toEqual(beforeT);
  expect(restored.vars).toEqual(beforeV);
  expect(snap.recipeTitle).toBe(recipe.title);
});
