/**
 * The lore platform-card contract - the character editor's platforms/<key>.ts doctrine applied to
 * lorebooks: ONE FILE PER PLATFORM declares that platform's long-tail entry fields, rendered as a
 * platform-named folded card at the page's foot. A platform with no long tail simply has no file
 * (deny by absence). `lenses` names the Write-for lenses that surface the card; the Vaude (full)
 * lens surfaces every card.
 */
import type { JSX } from "react";
import type { LorebookEntry } from "../../../../../entities/lorebook/schema";
import type { LoreFieldKey, LoreWriteForProfile } from "../../../../../core/lore";

export interface LorePlatformCardProps {
  entry: LorebookEntry;
  /** capability gate for this lens (hidden fields stay in data) */
  show: (key: LoreFieldKey) => boolean;
  styles: Readonly<Record<string, string>>;
  onPatch: (patch: Partial<LorebookEntry>) => void;
}

export interface LorePlatformCard {
  /** stable card id ("sillytavern", "rolecall", ...) */
  id: string;
  /** the card's title - the platform's own name, never a smush of several */
  label: string;
  /** which non-full lenses surface this card (full always does) */
  lenses: readonly LoreWriteForProfile[];
  Component: (props: LorePlatformCardProps) => JSX.Element | null;
}

export const cardVisible = (card: LorePlatformCard, writeFor: LoreWriteForProfile): boolean =>
  writeFor === "full" || card.lenses.includes(writeFor);
