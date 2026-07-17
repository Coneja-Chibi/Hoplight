/**
 * CSS recipe registry. Add pack = recipes/<id>/index.ts + one import here.
 */
import type { CssRecipe } from "./contract";
import softCard from "./soft-card";
import darkGlass from "./dark-glass";
import noGradient from "./no-gradient";
import neonOutline from "./neon-outline";
import readableType from "./readable-type";

const PACKS: readonly CssRecipe[] = [
  softCard,
  darkGlass,
  noGradient,
  neonOutline,
  readableType,
];

export function listCssRecipes(packId?: string): readonly CssRecipe[] {
  const all = [...PACKS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
  if (!packId) return all;
  return all.filter((r) => !r.packs || r.packs.length === 0 || r.packs.includes(packId));
}

export function cssRecipeById(id: string): CssRecipe | undefined {
  return PACKS.find((r) => r.id === id);
}

export const registeredCssRecipeIds = (): string[] => PACKS.map((r) => r.id);
