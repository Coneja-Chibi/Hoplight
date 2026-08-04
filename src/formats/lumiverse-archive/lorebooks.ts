/**
 * The lorebook slice (spec Behavior step 5, lorebook row; step 6 for the book's own link; step 7 for
 * isolation). `world_books` + `world_book_entries` are close enough to ST worldinfo that mapping
 * logic should exist exactly once: this module's whole job is turning one book row plus its entry
 * rows into the ST worldbook wire the SillyTavern lorebook codec already parses, then dispatching to
 * that codec by direct path import (it self-describes as not registry-wired, same as the RC lorebook
 * codec). No field mapping lives here twice.
 *
 * Entries do not arrive grouped by book: a real export has no ORDER BY guarantee, so a book's rows
 * can be scattered anywhere in world_book_entries.ndjson. `joinWorldBooks` reads both tables exactly
 * once each and buckets entries by `world_book_id` as they stream past, then yields each book paired
 * with the entries that named it. Nothing here re-opens the entries entry or reads it a second time
 * per book; the huge-lorebook edge case (spec edge case 9: one real book's entries spread across
 * 22,770 total rows) is exactly why a per-book re-scan would be the wrong shape.
 */
import type { CanonicalLorebook } from "../../entities/lorebook/schema";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import stWorldbook from "../sillytavern/lorebook";
import { addArchiveEscrow } from "./escrow";
import type { LinkMap } from "./links";
import { recordFailure, recordImported, type LvbakImportReport } from "./report";
import type { LvbakEntrySource } from "./source";
import { innerJsonRowFailure, readTable, type ReadTableOptions, type TableRow } from "./table-walk";
import { rowId } from "./tables";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
/** Same string-or-number tolerance as rowId, for a foreign key column rather than a row's own id. */
const asId = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";

/**
 * One book's rows joined to its entries, in `world_books` read order. `entries` carries every row
 * that named this book, inner-JSON failures included; the caller decides row policy, this only
 * groups.
 */
export interface WorldBookJoin {
  book: TableRow;
  entries: TableRow[];
}

/**
 * Read `world_books` and `world_book_entries` once each, then yield the join. Both tables have to be
 * fully read before anything can be yielded: a book's last entry could be the very last line of the
 * entries dump, so there is no point at which a book's group is known complete before the whole
 * table has passed. Streaming here means one pass over each entry, not early yield.
 */
export async function* joinWorldBooks(
  source: LvbakEntrySource,
  opts: ReadTableOptions,
): AsyncGenerator<WorldBookJoin> {
  const books: TableRow[] = [];
  const bookIds = new Set<string>();
  for await (const read of readTable(source, "world_books", opts)) {
    const id = rowId(read.row);
    if (!id) continue; // an id-less book row can never be joined to any entry, so it cannot be found again
    books.push(read);
    bookIds.add(id);
  }

  const entriesByBook = new Map<string, TableRow[]>();
  for await (const read of readTable(source, "world_book_entries", opts)) {
    const bookId = asId(read.row.world_book_id);
    if (!bookId || !bookIds.has(bookId)) continue; // orphaned entry: its book was skipped or never existed
    let bucket = entriesByBook.get(bookId);
    if (!bucket) {
      bucket = [];
      entriesByBook.set(bookId, bucket);
    }
    bucket.push(read);
  }

  for (const book of books) {
    yield { book, entries: entriesByBook.get(rowId(book.row)) ?? [] };
  }
}

/**
 * A placeholder entry used only when a book has zero entries left to synthesize. The ST codec's own
 * detection (`readBook` in sillytavern/lorebook.ts) sniffs the first entry for `key`/`keysecondary`/
 * `comment`/`content` to tell an ST worldbook apart from an arbitrary JSON object; an `entries: {}`
 * object has no first entry to sniff, so `toCanonical` throws "not a recognizable world info book"
 * for a book that is genuinely, validly empty (spec edge case 10). This placeholder satisfies the
 * sniff; importLorebooks strips it back out of the result once dispatch succeeds, so no fabricated
 * entry ever survives into a returned entity.
 */
const EMPTY_BOOK_SNIFF_ENTRY = { comment: "", content: "", key: [] as string[] };

/**
 * Build the ST worldbook wire `sillytavern-lorebook` already parses, from one book row and the
 * TableRow reads of its already-valid entries (their inner JSON must have already parsed clean;
 * this never fails, it only shapes). Keys come from `inner.values`, the second-parsed arrays, not
 * `row` (still the doubly encoded string) - the raw row is what escrow needs verbatim, so this reads
 * both halves of the same TableRow rather than choosing one.
 *
 * Lumiverse's own columns line up with ST's almost by name, with the exceptions this function exists
 * to bridge: `use_regex` has no ST wire slot of its own, ST folds regex-ness into the keyword string
 * itself (`/pattern/flags`), so a regex entry's keys are wrapped here rather than carried as a
 * separate flag. `vectorized` (both tables) and `world_books.metadata` are Lumiverse's own
 * vector-store bookkeeping, not ST's per-entry RAG toggle of the same name despite sharing a wire
 * key; the spec sends them to escrow only, so they never reach this wire.
 */
export function worldBookToStWire(
  bookRow: Record<string, unknown>,
  entries: readonly TableRow[],
): Record<string, unknown> {
  const wireEntries: Record<string, Record<string, unknown>> = {};
  if (entries.length === 0) {
    wireEntries["0"] = EMPTY_BOOK_SNIFF_ENTRY;
  } else {
    entries.forEach((read, index) => {
      wireEntries[String(index)] = entryRowToWireEntry(read, index);
    });
  }
  return {
    name: asString(bookRow.name),
    description: asString(bookRow.description),
    entries: wireEntries,
  };
}

function entryRowToWireEntry(read: TableRow, index: number): Record<string, unknown> {
  const row = read.row;
  const useRegex = row.use_regex === 1;
  const wrap = (k: string): string => (useRegex ? `/${k}/` : k);
  const probability = typeof row.probability === "number" ? row.probability : 100;

  return {
    uid: rowId(row) || String(index),
    comment: row.comment,
    content: row.content,
    key: asStringArray(read.inner.values.key).map(wrap),
    keysecondary: asStringArray(read.inner.values.keysecondary).map(wrap),
    constant: row.constant === 1,
    disable: row.disable === 1,
    selectiveLogic: row.selective_logic,
    position: row.position,
    depth: row.depth,
    order: row.order_value,
    probability,
    useProbability: probability < 100,
    scanDepth: row.scan_depth,
    sticky: row.sticky,
    cooldown: row.cooldown,
    delay: row.delay,
  };
}

export interface ImportLorebooksOptions {
  lineCeiling: number;
  report: LvbakImportReport;
  links: LinkMap;
}

/**
 * Import every lorebook: join the two tables, drop and report entries whose inner JSON would not
 * parse (spec Behavior step 7, per-row isolation), synthesize and dispatch the survivors, escrow the
 * raw twin, and record the book under its Lumiverse id so a later persona or regex row can resolve
 * `attached_world_book_id` / scoping through the link map (step 6).
 */
export async function importLorebooks(
  source: LvbakEntrySource,
  options: ImportLorebooksOptions,
): Promise<ParsedCanonicalEntity[]> {
  const { lineCeiling, report, links } = options;
  const opts: ReadTableOptions = {
    lineCeiling,
    onFailure: (failure) => recordFailure(report, failure),
  };

  const out: ParsedCanonicalEntity[] = [];
  for await (const { book, entries } of joinWorldBooks(source, opts)) {
    const valid: TableRow[] = [];
    for (const entry of entries) {
      const failure = innerJsonRowFailure("world_book_entries", entry);
      if (failure) recordFailure(report, failure);
      else valid.push(entry);
    }

    const wire = worldBookToStWire(book.row, valid);
    const entity: CanonicalLorebook = stWorldbook.toCanonical({ text: JSON.stringify(wire) });
    if (valid.length === 0) {
      // Strip the sniff placeholder from BOTH surfaces that would carry it forward: body.entries,
      // and the codec twin's raw wire — fromCanonical re-exports from that raw, so leaving the
      // placeholder there would fabricate an entry in a round-trip of a genuinely empty book.
      entity.body.entries = [];
      const twin = entity.original?.["sillytavern-lorebook"];
      if (twin) twin.raw = { ...wire, entries: {} };
    }

    const escrowed = addArchiveEscrow(entity, "world_books", {
      book: book.row,
      entries: entries.map((e) => e.row),
    });
    links.record("world_books", rowId(book.row), { id: escrowed.id, name: escrowed.body.name });
    recordImported(report, "lorebook", { id: escrowed.id, name: escrowed.body.name });
    out.push(escrowed);
  }
  return out;
}
