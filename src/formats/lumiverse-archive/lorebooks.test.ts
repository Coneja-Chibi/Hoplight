/**
 * The lorebook slice: a book plus its entries becomes a real CanonicalLorebook via the SillyTavern
 * worldbook codec, a broken entry loses only itself, and entries scattered across a huge dump still
 * land in the right book from a single pass over each table.
 */
import { describe, expect, test } from "bun:test";
import {
  HUGE_LOREBOOK_BOOK_IDS,
  buildBadRowsLvbak,
  buildHugeLorebookLvbak,
  buildMinimalLvbak,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { WORLD_BOOK_ID } from "../_fixtures/lumiverse-archive/rows";
import { createIdMint, createLinkMap } from "./links";
import { importLorebooks, joinWorldBooks, worldBookToStWire } from "./lorebooks";
import { ndjsonLineCeiling } from "./ndjson";
import { createLvbakReport } from "./report";
import type { LvbakEntrySource } from "./source";
import type { ReadTableOptions, TableRow } from "./table-walk";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);
const noFailures = () => expect.unreachable();

/** Wraps a source to count how many times each entry name is opened, proving a single pass. */
function countingSource(inner: LvbakEntrySource): { source: LvbakEntrySource; opens: Map<string, number> } {
  const opens = new Map<string, number>();
  return {
    opens,
    source: {
      list: () => inner.list(),
      rejected: () => inner.rejected(),
      size: (name) => inner.size(name),
      open: (name) => {
        opens.set(name, (opens.get(name) ?? 0) + 1);
        return inner.open(name);
      },
    },
  };
}

describe("worldBookToStWire", () => {
  const entryRead = (over: Partial<TableRow["row"]> = {}, inner: Record<string, unknown> = {}): TableRow => ({
    line: 1,
    row: {
      id: "lv-entry-x",
      comment: "Title",
      content: "Body",
      selective: 1,
      selective_logic: 0,
      constant: 0,
      disable: 0,
      position: 0,
      depth: 4,
      order_value: 7,
      probability: 100,
      scan_depth: 2,
      sticky: 0,
      cooldown: 0,
      delay: 0,
      use_regex: 0,
      ...over,
    },
    inner: { values: { key: ["alpha"], keysecondary: [], ...inner }, failures: [] },
  });

  test("flat columns and inner JSON arrays map onto the ST wire keys", () => {
    const wire = worldBookToStWire({ name: "Book", description: "Desc" }, [entryRead()]);
    expect(wire).toMatchObject({ name: "Book", description: "Desc" });
    const entry = (wire.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect(entry).toMatchObject({
      uid: "lv-entry-x",
      comment: "Title",
      content: "Body",
      key: ["alpha"],
      keysecondary: [],
      constant: false,
      disable: false,
      selectiveLogic: 0,
      position: 0,
      depth: 4,
      order: 7,
      scanDepth: 2,
      sticky: 0,
      cooldown: 0,
      delay: 0,
    });
  });

  test("use_regex wraps every key and keysecondary as /keyword/, not just the first", () => {
    const read = entryRead({ use_regex: 1 }, { key: ["alpha", "beta"], keysecondary: ["gamma"] });
    const wire = worldBookToStWire({ name: "Book" }, [read]);
    const entry = (wire.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect(entry.key).toEqual(["/alpha/", "/beta/"]);
    expect(entry.keysecondary).toEqual(["/gamma/"]);
  });

  test("useProbability follows the probability ceiling", () => {
    const atCeiling = worldBookToStWire({ name: "B" }, [entryRead({ probability: 100 })]);
    const belowCeiling = worldBookToStWire({ name: "B" }, [entryRead({ probability: 40 })]);
    const at = (atCeiling.entries as Record<string, Record<string, unknown>>)["0"]!;
    const below = (belowCeiling.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect(at.useProbability).toBe(false);
    expect(below.useProbability).toBe(true);
    expect(below.probability).toBe(40);
  });

  test("selective 0/false: keysecondary is never emitted, even when the column has values", () => {
    const read = entryRead({ selective: 0 }, { keysecondary: ["gamma"] });
    const wire = worldBookToStWire({ name: "Book" }, [read]);
    const entry = (wire.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect("keysecondary" in entry).toBe(false);
  });

  test("selective truthy: keysecondary is emitted as usual", () => {
    const read = entryRead({ selective: 1 }, { keysecondary: ["gamma"] });
    const wire = worldBookToStWire({ name: "Book" }, [read]);
    const entry = (wire.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect(entry.keysecondary).toEqual(["gamma"]);
  });

  test("boolean columns tolerate a genuine true/false, not just SQLite's 0/1", () => {
    // Reviewer's repro: `disabled: true` (a real boolean, not the SQLite 0/1 this table normally
    // carries) previously fell through `=== 1` to false, silently importing a disabled entry as
    // enabled.
    const read = entryRead({ constant: true, disable: true, use_regex: true }, { key: ["a"] });
    const wire = worldBookToStWire({ name: "Book" }, [read]);
    const entry = (wire.entries as Record<string, Record<string, unknown>>)["0"]!;
    expect(entry.constant).toBe(true);
    expect(entry.disable).toBe(true);
    expect(entry.key).toEqual(["/a/"]);
  });

  test("zero entries synthesize the sniff placeholder, not an empty entries object", () => {
    const wire = worldBookToStWire({ name: "Empty Book" }, []);
    const entries = wire.entries as Record<string, Record<string, unknown>>;
    expect(Object.keys(entries)).toEqual(["0"]);
    expect(entries["0"]).toEqual({ comment: "", content: "", key: [] });
  });
});

describe("joinWorldBooks", () => {
  test("the minimal fixture's one entry joins its one book", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const opts: ReadTableOptions = { lineCeiling: V1_CEILING, onFailure: noFailures };
    const joins = [];
    for await (const join of joinWorldBooks(source, opts)) joins.push(join);
    expect(joins).toHaveLength(1);
    expect(joins[0]!.book.row.id).toBe(WORLD_BOOK_ID);
    expect(joins[0]!.entries).toHaveLength(1);
    expect(joins[0]!.entries[0]!.row.world_book_id).toBe(WORLD_BOOK_ID);
  });

  test("interleaved entries group by world_book_id without assuming contiguity", async () => {
    const source = zipEntrySource(buildHugeLorebookLvbak());
    const opts: ReadTableOptions = { lineCeiling: V1_CEILING, onFailure: noFailures };
    const byBook = new Map<string, TableRow[]>();
    for await (const { book, entries } of joinWorldBooks(source, opts)) {
      byBook.set(book.row.id as string, entries);
    }
    expect([...byBook.keys()].sort()).toEqual([...HUGE_LOREBOOK_BOOK_IDS].sort());
    for (const bookId of HUGE_LOREBOOK_BOOK_IDS) {
      const entries = byBook.get(bookId)!;
      expect(entries).toHaveLength(1000);
      // every entry landed in the bucket it actually named, not just the right COUNT
      expect(entries.every((e) => e.row.world_book_id === bookId)).toBe(true);
    }
  });

  test("world_books and world_book_entries are each opened exactly once", async () => {
    const { source, opens } = countingSource(zipEntrySource(buildHugeLorebookLvbak()));
    const opts: ReadTableOptions = { lineCeiling: V1_CEILING, onFailure: noFailures };
    for await (const _join of joinWorldBooks(source, opts)) {
      // drain; the count is what this test is proving
    }
    expect(opens.get("database/world_books.ndjson")).toBe(1);
    expect(opens.get("database/world_book_entries.ndjson")).toBe(1);
  });
});

describe("importLorebooks", () => {
  test("a book plus its entry becomes a real CanonicalLorebook, escrowed and linked", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const entities = await importLorebooks(source, { lineCeiling: V1_CEILING, report, links, idMint: createIdMint() });

    expect(entities).toHaveLength(1);
    const entity = entities[0]!;
    expect(entity.kind).toBe("lorebook");
    if (entity.kind !== "lorebook") throw new Error("unreachable");
    expect(entity.body.name).toBe("Test World Book Alpha");
    expect(entity.body.entries).toHaveLength(1);
    const only = entity.body.entries[0]!;
    expect(only.title).toBe("Fixture entry");
    expect(only.content).toBe("Alpha is a placeholder concept invented for this fixture.");
    expect(only.triggers.map((t) => t.keyword)).toEqual(["alpha", "test alpha"]);
    expect(only.secondaryTriggers.map((t) => t.keyword)).toEqual(["fixture"]);
    expect(only.sortOrder).toBe(100);
    expect(only.scanDepth).toBe(2);
    expect(only.enabled).toBe(true);

    // the codec's own twin is first, the archive's raw twin is appended after it
    expect(Object.keys(entity.original!)).toEqual(["sillytavern-lorebook", "lumiverse-archive"]);
    const archived = entity.original!["lumiverse-archive"]!.raw as {
      book: Record<string, unknown>;
      entries: Record<string, unknown>[];
    };
    expect(archived.book.id).toBe(WORLD_BOOK_ID);
    expect(typeof archived.book.metadata).toBe("string"); // verbatim, not second-parsed
    expect(archived.entries).toHaveLength(1);
    expect(typeof archived.entries[0]!.key).toBe("string");

    expect(report.imported.lorebook).toEqual([{ id: entity.id, name: "Test World Book Alpha" }]);
    expect(links.resolve("x", "world_books", WORLD_BOOK_ID, createLvbakReport())).toEqual({
      id: entity.id,
      name: "Test World Book Alpha",
    });
  });

  test("a broken entry fails alone; its book still imports, and its sibling book is unaffected", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    const report = createLvbakReport();
    const links = createLinkMap();
    const entities = await importLorebooks(source, { lineCeiling: V1_CEILING, report, links, idMint: createIdMint() });

    expect(entities).toHaveLength(2);
    const byName = new Map(
      entities.map((e) => [e.kind === "lorebook" ? e.body.name : "", e]),
    );

    const alpha = byName.get("Test World Book Alpha")!;
    if (alpha.kind !== "lorebook") throw new Error("unreachable");
    // the broken entry (key: '["alpha"') is gone, its valid sibling entry survived
    expect(alpha.body.entries).toHaveLength(1);
    expect(alpha.body.entries[0]!.id).toBe("lv-entry-000000000001");

    // "Test World Book Broken" has no entries referencing it in this fixture at all, and its own
    // metadata parse failure never gates import (metadata is escrow-only, never mapped): it still
    // imports, empty, same as any other book with zero entries
    const broken = byName.get("Test World Book Broken")!;
    if (broken.kind !== "lorebook") throw new Error("unreachable");
    expect(broken.body.entries).toEqual([]);
    // the sniff placeholder is scrubbed from the codec twin's raw too: fromCanonical re-exports
    // from that raw, so an empty book must escrow an empty entries object, not the placeholder
    const twinRaw = broken.original?.["sillytavern-lorebook"]?.raw as {
      entries: Record<string, unknown>;
    };
    expect(twinRaw.entries).toEqual({});

    const entryFailure = report.failed.find((f) => f.table === "world_book_entries");
    expect(entryFailure).toBeDefined();
    expect(entryFailure!.rowId).toBe("lv-entry-000000000002");
    expect(entryFailure!.reason.startsWith("key")).toBe(true);

    expect(report.imported.lorebook).toHaveLength(2);
  });
});
