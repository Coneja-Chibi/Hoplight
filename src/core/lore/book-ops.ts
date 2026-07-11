/**
 * Pure lorebook split / merge / duplicate / renumber. No I/O; Studio API writes sit at the edge.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import { emptyLorebookBody } from "./empty-book";

const renumber = (entries: LorebookEntry[]): LorebookEntry[] =>
  [...entries]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e, i) => ({ ...e, sortOrder: i * 10 }));

const freshIds = (entries: LorebookEntry[], prefix: string): LorebookEntry[] =>
  entries.map((e, i) => ({
    ...structuredClone(e),
    id: `${prefix}${i + 1}`,
  }));

/** Sort by sortOrder, reindex from 0 step 10. */
export function renumberEntries(book: LorebookBody): LorebookBody {
  return { ...book, entries: renumber(book.entries) };
}

/**
 * Split: moved ids become the new book; remainder stays. Entry ids are preserved in each
 * result; sortOrder renumbered. Empty movedIds throws.
 */
export function splitBook(
  book: LorebookBody,
  movedIds: readonly string[],
  newName: string,
): { remainder: LorebookBody; split: LorebookBody } {
  if (movedIds.length === 0) {
    throw new Error("book-ops: split needs at least one entry to move");
  }
  const name = newName.trim() || "Split lorebook";
  const want = new Set(movedIds);
  const moved = book.entries.filter((e) => want.has(e.id));
  const kept = book.entries.filter((e) => !want.has(e.id));
  if (moved.length === 0) {
    throw new Error("book-ops: none of the moved ids exist in the book");
  }
  const remainder: LorebookBody = {
    ...book,
    entries: renumber(kept.length > 0 ? kept : []),
  };
  const split: LorebookBody = {
    ...emptyLorebookBody(name),
    description: book.description ?? null,
    tags: [...book.tags],
    globalCaseSensitive: book.globalCaseSensitive,
    globalMatchWholeWords: book.globalMatchWholeWords,
    globalScanDepth: book.globalScanDepth,
    globalRecursion: book.globalRecursion,
    tokenBudget: book.tokenBudget,
    budgetMode: book.budgetMode,
    entryBudget: book.entryBudget,
    entries: renumber(moved),
  };
  return { remainder, split };
}

/**
 * Merge two books into one. Fresh entry ids; sequential sortOrder. Name defaults to
 * "a + b" when blank.
 */
export function mergeBooks(a: LorebookBody, b: LorebookBody, newName?: string): LorebookBody {
  const name =
    (newName?.trim() ||
      [a.name, b.name]
        .map((n) => n.trim())
        .filter(Boolean)
        .join(" + ")) || "Merged lorebook";
  const combined = [
    ...freshIds(a.entries, "m_a_"),
    ...freshIds(b.entries, "m_b_"),
  ];
  return {
    ...emptyLorebookBody(name),
    description: a.description ?? b.description ?? null,
    tags: [...new Set([...a.tags, ...b.tags])],
    globalCaseSensitive: a.globalCaseSensitive,
    globalMatchWholeWords: a.globalMatchWholeWords,
    globalScanDepth: a.globalScanDepth,
    globalRecursion: a.globalRecursion || b.globalRecursion,
    tokenBudget: Math.max(a.tokenBudget, b.tokenBudget),
    budgetMode: a.budgetMode,
    entryBudget: Math.max(a.entryBudget, b.entryBudget),
    entries: renumber(combined),
  };
}

/** Deep clone with a new name; entry ids refreshed. */
export function duplicateBook(book: LorebookBody, name: string): LorebookBody {
  const n = name.trim() || `${book.name.trim() || "Lorebook"} (copy)`;
  return {
    ...structuredClone(book),
    name: n,
    entries: renumber(freshIds(book.entries, "dup_")),
  };
}
