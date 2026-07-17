/**
 * Pure recipe applicators (no discovery). Work on any WorkshopRecipe.
 */
import type { TriggerScript } from "../../../../../entities/character/schema";
import type { WorkshopRecipe } from "./contract";

/** Snapshot used to undo one starter apply. */
export interface RecipeApplySnap {
  recipeId: string;
  recipeTitle: string;
  triggers: TriggerScript[];
  vars: Array<{ name: string; value: string }>;
}

/** Append a recipe's triggers (deep-cloned) onto an existing list. */
export function applyRecipe(triggers: TriggerScript[], recipe: WorkshopRecipe): TriggerScript[] {
  const extra = recipe.triggers.map((t) => structuredClone(t));
  return [...triggers, ...extra];
}

/** Merge recipe default vars into existing console rows (do not clobber non-empty values). */
export function mergeRecipeVars(
  rows: Array<{ name: string; value: string }>,
  recipe: WorkshopRecipe,
): Array<{ name: string; value: string }> {
  const byName = new Map(rows.map((r) => [r.name, r]));
  for (const v of recipe.vars) {
    const cur = byName.get(v.name);
    if (!cur) byName.set(v.name, { name: v.name, value: v.value });
    else if (!cur.value) byName.set(v.name, { name: v.name, value: v.value });
  }
  return [...byName.values()];
}

/** Capture board state before applying a recipe (for one-step undo). */
export function stampRecipeApply(
  recipe: WorkshopRecipe,
  triggers: TriggerScript[],
  vars: Array<{ name: string; value: string }>,
): RecipeApplySnap {
  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    triggers: triggers.map((t) => structuredClone(t)),
    vars: vars.map((v) => ({ ...v })),
  };
}

/** Restore the snapshot from stampRecipeApply. */
export function undoRecipeApply(snap: RecipeApplySnap): {
  triggers: TriggerScript[];
  vars: Array<{ name: string; value: string }>;
} {
  return {
    triggers: snap.triggers.map((t) => structuredClone(t)),
    vars: snap.vars.map((v) => ({ ...v })),
  };
}
