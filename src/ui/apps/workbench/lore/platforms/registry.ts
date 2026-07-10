/**
 * The lore platform-card registry - the one stated seam (a browser bundle cannot glob; one import
 * line per platform, same pattern as the Library's view registry). Chub, Lumiverse, and Agnai
 * have no long tail beyond the core page, so they have no card files - deny by absence.
 */
import type { LorePlatformCard } from "./card-contract";
import type { LoreWriteForProfile } from "../../../../../core/lore";
import { cardVisible } from "./card-contract";
import sillytavern from "./sillytavern";
import rolecall from "./rolecall";
import novelai from "./novelai";
import risu from "./risu";

export const LORE_PLATFORM_CARDS: readonly LorePlatformCard[] = [sillytavern, rolecall, novelai, risu];

/** The cards the given lens surfaces (full = all of them). */
export function cardsForLens(writeFor: LoreWriteForProfile): LorePlatformCard[] {
  return LORE_PLATFORM_CARDS.filter((card) => cardVisible(card, writeFor));
}
