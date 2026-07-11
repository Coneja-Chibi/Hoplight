/**
 * Shared factories for lore core tests. Not part of the public API.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import type { ScanLine } from "./activation";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";

export const line = (text: string, role: ScanLine["role"] = "user"): ScanLine => ({ text, role });

export const entry = (id: string, patch: Partial<LorebookEntry> = {}): LorebookEntry => ({
  ...emptyLoreEntry(id),
  ...patch,
  id,
});

export const bookOf = (
  entries: LorebookEntry[],
  patch: Partial<LorebookBody> = {},
): LorebookBody => ({
  ...emptyLorebookBody("t"),
  globalMatchWholeWords: true,
  globalRecursion: true,
  entries,
  ...patch,
});
