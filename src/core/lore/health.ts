/**
 * Soft lore authoring diagnostics. Non-mutating; never rewrites the book.
 */
import type { LorebookBody } from "../../entities/lorebook/schema";

export type LoreHealthLevel = "info" | "warn";

export interface LoreHealthNote {
  level: LoreHealthLevel;
  code: string;
  message: string;
  entryId?: string;
}

export function loreHealth(body: LorebookBody): LoreHealthNote[] {
  const notes: LoreHealthNote[] = [];
  if (!body.name?.trim()) {
    notes.push({ level: "warn", code: "book_unnamed", message: "Book has no name" });
  }
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) {
    notes.push({ level: "info", code: "empty_book", message: "Book has no entries yet" });
  }
  for (const e of entries) {
    if (!e.title?.trim() && !e.content?.trim()) {
      notes.push({
        level: "warn",
        code: "empty_entry",
        message: "Entry has no title or content",
        entryId: e.id,
      });
    }
    if (!e.constant && e.triggers.length === 0 && e.secondaryTriggers.length === 0) {
      notes.push({
        level: "info",
        code: "no_keys",
        message: `Entry "${e.title || e.id}" has no keys and is not constant`,
        entryId: e.id,
      });
    }
  }
  return notes;
}
