/**
 * Pure lorebook split / merge / duplicate / renumber. No I/O; Studio API writes sit at the edge.
 */
import type { LorebookBody, LorebookCategory, LorebookEntry } from "../../entities/lorebook/schema";

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
  // Spread the WHOLE source, never an enumerated subset: an enumerated build silently dropped every
  // field not on its list (categories, lorebookType, genre, fandom, enabled) and left moved entries'
  // categoryId dangling. Both halves keep every folder; unused ones are clutter, not corruption.
  const split: LorebookBody = {
    ...structuredClone(book),
    name,
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
  // Categories get the same fresh-id treatment as entries: both books may use the same category id
  // for different folders, so each side's ids are reminted and its entries' refs follow the map.
  const remintCats = (
    cats: LorebookCategory[] | undefined,
    prefix: string,
  ): { cats: LorebookCategory[]; map: Map<string, string> } => {
    const map = new Map<string, string>();
    const out = (cats ?? []).map((c, i) => {
      const id = `${prefix}${i + 1}`;
      map.set(c.id, id);
      return { ...structuredClone(c), id };
    });
    return { cats: out, map };
  };
  const catsA = remintCats(a.categories, "m_a_c");
  const catsB = remintCats(b.categories, "m_b_c");
  const followCats = (entries: LorebookEntry[], map: Map<string, string>): LorebookEntry[] =>
    entries.map((e) =>
      e.categoryId != null && map.has(e.categoryId)
        ? { ...e, categoryId: map.get(e.categoryId)! }
        : e,
    );
  const combined = [
    ...followCats(freshIds(a.entries, "m_a_"), catsA.map),
    ...followCats(freshIds(b.entries, "m_b_"), catsB.map),
  ];
  // Base the merged book on a whole clone of `a` (the "into" book) so no body field is dropped;
  // override only what merging actually combines.
  const merged: LorebookBody = {
    ...structuredClone(a),
    name,
    description: a.description ?? b.description ?? null,
    tags: [...new Set([...a.tags, ...b.tags])],
    globalRecursion: a.globalRecursion || b.globalRecursion,
    tokenBudget: Math.max(a.tokenBudget, b.tokenBudget),
    entryBudget: Math.max(a.entryBudget, b.entryBudget),
    entries: renumber(combined),
  };
  const cats = [...catsA.cats, ...catsB.cats];
  if (cats.length > 0) merged.categories = cats;
  else delete merged.categories;
  return merged;
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

/** Press / export: drop books whose book-level enabled is explicitly false. */
export function filterEnabledBooks<T extends { body?: { enabled?: boolean } }>(
  books: readonly T[],
): T[] {
  return books.filter((b) => b.body?.enabled !== false);
}
