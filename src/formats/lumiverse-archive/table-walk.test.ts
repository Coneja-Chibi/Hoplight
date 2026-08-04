/**
 * The table walk and the report it feeds. Two things are being pinned: a broken row never takes
 * the table down with it, and the report tells the truth about what was never read, including the
 * difference between "zero rows" and "we do not know how many".
 */
import { describe, expect, test } from "bun:test";
import {
  SKIPPED_TABLE_COUNTS,
  assembleLvbak,
  buildBadRowsLvbak,
  buildMinimalLvbak,
  buildSecretsAndVectorsLvbak,
  lvbakManifest,
  lvbakStats,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { characterRow, personaRow } from "../_fixtures/lumiverse-archive/rows";
import { ndjsonLineCeiling } from "./ndjson";
import { readManifest, readStats } from "./manifest";
import {
  ENCRYPTED_SECRETS_WARNING,
  VECTORS_WARNING,
  applyManifestWarnings,
  createLvbakReport,
  recordFailure,
  recordImported,
  recordMissingBinary,
  reportTotals,
  setSkippedTables,
  type LvbakRowFailure,
} from "./report";
import { innerJsonRowFailure, planTableWalk, readTable } from "./table-walk";
import { KNOWN_SKIPPED_TABLES, MAPPED_TABLES, TABLE_KINDS, isMappedTable } from "./tables";
import { zipEntrySource } from "./zip-source";

const V1_CEILING = ndjsonLineCeiling(1);

interface Walked {
  ids: string[];
  failed: LvbakRowFailure[];
}

/** Read one table under the default policy: an unparseable inner column fails the row. */
const walk = async (bytes: Uint8Array, table: string): Promise<Walked> => {
  const source = zipEntrySource(bytes);
  const out: Walked = { ids: [], failed: [] };
  for await (const read of readTable(source, table, {
    lineCeiling: V1_CEILING,
    onFailure: (failure) => out.failed.push(failure),
  })) {
    const failure = innerJsonRowFailure(table, read);
    if (failure) out.failed.push(failure);
    else out.ids.push(String(read.row.id));
  }
  return out;
};

describe("the table registry", () => {
  test("no table the spec refuses has drifted into the mapped set", () => {
    for (const table of KNOWN_SKIPPED_TABLES) {
      expect([table, isMappedTable(table)]).toEqual([table, false]);
    }
  });

  test("every mapped table declares whether it produces a kind of its own", () => {
    for (const table of MAPPED_TABLES) expect(table in TABLE_KINDS).toBe(true);
    // these three only feed another kind: entries join their book, images ride a character
    expect(TABLE_KINDS.world_book_entries).toBeNull();
    expect(TABLE_KINDS.images).toBeNull();
    expect(TABLE_KINDS.character_gallery).toBeNull();
    expect(TABLE_KINDS.characters).toBe("character");
    expect(TABLE_KINDS.world_books).toBe("lorebook");
  });
});

describe("readTable", () => {
  test("streams a mapped table and parses its inner JSON columns", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const reads = [];
    for await (const read of readTable(source, "characters", {
      lineCeiling: V1_CEILING,
      onFailure: () => expect.unreachable(),
    })) {
      reads.push(read);
    }
    expect(reads).toHaveLength(1);
    const only = reads[0]!;
    expect(only.line).toBe(1);
    expect(only.inner.failures).toEqual([]);
    const extensions = only.inner.values.extensions as Record<string, unknown>;
    expect(extensions.lumiverse_modules).toBeDefined();
    expect(only.inner.values.tags).toEqual(["fixture", "synthetic"]);
    // the raw row is untouched, so the doubly encoded string survives for escrow
    expect(typeof only.row.extensions).toBe("string");
  });

  test("a table with no dump in the archive yields nothing and warns about nothing", async () => {
    const source = zipEntrySource(
      assembleLvbak({ manifest: lvbakManifest(), tables: { characters: [] }, stats: null }),
    );
    const failures: LvbakRowFailure[] = [];
    const reads = [];
    for await (const read of readTable(source, "presets", {
      lineCeiling: V1_CEILING,
      onFailure: (f) => failures.push(f),
    })) {
      reads.push(read);
    }
    expect(reads).toEqual([]);
    expect(failures).toEqual([]);
  });

  test("a zero-row table is a zero-length entry, and that is not an error", async () => {
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables: { characters: [], personas: [personaRow()] },
      stats: null,
    });
    expect(await walk(bytes, "characters")).toEqual({ ids: [], failed: [] });
    expect((await walk(bytes, "personas")).ids).toHaveLength(1);
  });
});

describe("per-row isolation", () => {
  test("one broken inner-JSON row fails while its sibling imports, in every table", async () => {
    const bytes = buildBadRowsLvbak();
    const cases: Array<[table: string, column: string]> = [
      ["characters", "extensions"],
      ["world_books", "metadata"],
      ["world_book_entries", "key"],
      ["presets", "prompts"],
      ["personas", "metadata"],
      ["regex_scripts", "placement"],
    ];
    for (const [table, column] of cases) {
      const result = await walk(bytes, table);
      expect([table, result.ids.length]).toEqual([table, 1]);
      expect([table, result.failed.length]).toEqual([table, 1]);
      const failure = result.failed[0]!;
      expect([table, failure.table]).toEqual([table, table]);
      expect([table, failure.reason.startsWith(column)]).toEqual([table, true]);
      // the failure names the row, so a user can find it in Lumiverse
      expect([table, failure.rowId.length > 0]).toEqual([table, true]);
    }
  });

  test("a failed row carries its name when the row had one", async () => {
    const result = await walk(buildBadRowsLvbak(), "characters");
    expect(result.failed[0]!.name).toBe("Test Character Broken");
  });

  test("a character is the documented exception: flat columns can outlive extensions", async () => {
    const source = zipEntrySource(buildBadRowsLvbak());
    const reads = [];
    for await (const read of readTable(source, "characters", {
      lineCeiling: V1_CEILING,
      onFailure: () => expect.unreachable(),
    })) {
      reads.push(read);
    }
    const broken = reads[1]!;
    expect(broken.inner.failures.map((f) => f.column)).toEqual(["extensions"]);
    // the flat columns and the raw string both survive, which is what edge case 7 needs
    expect(broken.row.name).toBe("Test Character Broken");
    expect(broken.row.first_mes).toBeTruthy();
    expect(typeof broken.row.extensions).toBe("string");
    // tags parsed fine, so one bad column does not poison the rest of the row
    expect(broken.inner.values.tags).toEqual(["fixture", "synthetic"]);
  });
});

describe("planTableWalk", () => {
  test("mapped tables come back in import-safe order, skipped ones with their counts", async () => {
    const source = zipEntrySource(buildMinimalLvbak());
    const plan = planTableWalk(await source.list(), await readStats(source));

    expect(plan.mapped).toEqual([
      "characters",
      "images",
      "world_books",
      "world_book_entries",
      "presets",
      "personas",
      "regex_scripts",
    ]);
    const byTable = new Map(plan.skipped.map((s) => [s.table, s.rows]));
    expect(byTable.get("chats")).toBe(SKIPPED_TABLE_COUNTS.chats);
    expect(byTable.get("messages")).toBe(SKIPPED_TABLE_COUNTS.messages);
    // a mapped table is never reported as skipped
    expect(byTable.has("characters")).toBe(false);
  });

  test("rows is null, never zero, when no stats were available", async () => {
    const source = zipEntrySource(
      assembleLvbak({
        manifest: lvbakManifest(),
        tables: { characters: [characterRow()], chats: [], loom_tools: [] },
        stats: null,
      }),
    );
    const plan = planTableWalk(await source.list(), await readStats(source));
    expect(plan.mapped).toEqual(["characters"]);
    expect(plan.skipped).toEqual([
      { table: "chats", rows: null },
      { table: "loom_tools", rows: null },
    ]);
  });

  test("a table counted in stats with no dump of its own is still reported", async () => {
    const tables = { characters: [characterRow()] };
    const source = zipEntrySource(
      assembleLvbak({
        manifest: lvbakManifest(),
        tables,
        stats: lvbakStats(tables),
      }),
    );
    const plan = planTableWalk(await source.list(), await readStats(source));
    // chats has no database/chats.ndjson here, only a stats count, and must not vanish
    expect(plan.skipped.map((s) => s.table)).toContain("chats");
  });
});

describe("the report", () => {
  test("starts empty across every kind", () => {
    const report = createLvbakReport();
    expect(Object.keys(report.imported).sort()).toEqual([
      "character",
      "lorebook",
      "persona",
      "preset",
      "regex",
    ]);
    expect(reportTotals(report)).toEqual({ imported: 0, failed: 0, skippedTables: 0 });
  });

  test("collects imports, failures, and skipped tables with real totals", async () => {
    const report = createLvbakReport();
    const source = zipEntrySource(buildBadRowsLvbak());
    setSkippedTables(report, planTableWalk(await source.list(), await readStats(source)).skipped);

    const walked = await walk(buildBadRowsLvbak(), "characters");
    for (const id of walked.ids) recordImported(report, "character", { id, name: "Alpha" });
    for (const failure of walked.failed) recordFailure(report, failure);

    const totals = reportTotals(report);
    expect(totals.imported).toBe(1);
    expect(totals.failed).toBe(1);
    expect(totals.skippedTables).toBeGreaterThan(0);
  });

  test("missing binaries and warnings are deduped", () => {
    const report = createLvbakReport();
    recordMissingBinary(report, "files/avatars/a.png");
    recordMissingBinary(report, "files/avatars/a.png");
    recordMissingBinary(report, "files/avatars/b.png");
    expect(report.missingBinaries).toEqual(["files/avatars/a.png", "files/avatars/b.png"]);
  });

  test("the two content flags each raise their standing warning exactly once", async () => {
    const report = createLvbakReport();
    const manifest = await readManifest(zipEntrySource(buildSecretsAndVectorsLvbak()));
    applyManifestWarnings(report, manifest!);
    applyManifestWarnings(report, manifest!);
    expect(report.warnings).toEqual([ENCRYPTED_SECRETS_WARNING, VECTORS_WARNING]);
  });

  test("an archive with neither flag raises neither warning", async () => {
    const report = createLvbakReport();
    const manifest = await readManifest(zipEntrySource(buildMinimalLvbak()));
    applyManifestWarnings(report, manifest!);
    expect(report.warnings).toEqual([]);
  });
});
