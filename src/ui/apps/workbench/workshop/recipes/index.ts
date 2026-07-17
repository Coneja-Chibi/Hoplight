/**
 * Workshop recipes public surface: folders-as-schema packs + pure apply helpers.
 * Drop a folder in recipes/<id>/, register it in registry.ts (one import line).
 */
export type { WorkshopRecipe } from "./contract";
export type { RecipeApplySnap } from "./apply";
export {
  applyRecipe,
  mergeRecipeVars,
  stampRecipeApply,
  undoRecipeApply,
} from "./apply";
export { listRecipes, recipeById, registeredRecipeIds } from "./registry";
