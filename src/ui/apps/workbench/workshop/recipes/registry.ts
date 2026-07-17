/**
 * Recipe registry - the ONE browser-side seam for drop-in packs.
 * A browser bundle cannot glob the filesystem (same law as settings sections / deck views).
 * Adding a pack = recipes/<id>/index.ts default-export + ONE import line here.
 * Folder name must equal recipe.id. Tests scan the disk and fail if a pack is missing here.
 */
import type { WorkshopRecipe } from "./contract";
import affection from "./affection";
import dayStart from "./day-start";
import diceBranch from "./dice-branch";
import hpHurt from "./hp-hurt";
import inventoryUse from "./inventory-use";

/** Registered packs only. Do not put recipe bodies here. */
const PACKS: readonly WorkshopRecipe[] = [
  hpHurt,
  affection,
  dayStart,
  inventoryUse,
  diceBranch,
];

/** Sorted by order then id. */
export function listRecipes(): readonly WorkshopRecipe[] {
  return [...PACKS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
}

export function recipeById(id: string): WorkshopRecipe | undefined {
  return PACKS.find((r) => r.id === id);
}

/** Ids currently imported - used by the FS parity test. */
export const registeredRecipeIds = (): string[] => PACKS.map((r) => r.id);
