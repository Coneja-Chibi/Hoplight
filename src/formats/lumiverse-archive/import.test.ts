/**
 * The public API, end to end: every fixture archive built across M1-M8 runs through
 * `importLumiverseArchive` once, proving the pieces actually compose, not just that each one works
 * in isolation. Escrow assertions here are UNIVERSAL (every entity the minimal run produces), not
 * one spot check, because that is the guarantee the whole escrow doctrine exists to make.
 */
import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { isArchiveLimitError } from "../../core/archive";
import {
  assembleLvbak,
  buildBadRowsLvbak,
  buildCharacterGalleryLvbak,
  buildCrossLinksLvbak,
  buildFutureSchemaLvbak,
  buildHugeLorebookLvbak,
  buildIndirectBinaryLvbak,
  buildLegacyNoFormatVersionLvbak,
  buildMinimalLvbak,
  buildMissingBinariesLvbak,
  buildSecretsAndVectorsLvbak,
  buildWrongProducerZip,
  GALLERY_MISSING_IMAGE_FILENAME,
  HUGE_LOREBOOK_BOOK_IDS,
  INDIRECT_MISSING_IMAGE_FILENAME,
  lvbakManifest,
  lvbakStats,
  PNG_1X1,
  SKIPPED_TABLE_COUNTS,
} from "../_fixtures/lumiverse-archive/build-lvbak";
import { materializeLvbak, removeMaterialized } from "../_fixtures/lumiverse-archive/materialize";
import {
  CHARACTER_AVATAR,
  characterRow,
  DANGLING_ID,
  imageRow,
  personaRow,
  PERSONA_AVATAR,
  regexScriptRow,
  worldBookRow,
} from "../_fixtures/lumiverse-archive/rows";
import { LVBAK_ARCHIVE_BOUNDS } from "./bounds";
import { directoryEntrySource } from "./dir-source";
import { importLumiverseArchive, IMPORT_STAGE_ORDER, LvbakSchemaError } from "./import";
import { reportTotals } from "./report";
import { MAPPED_TABLES, TABLE_KINDS, type LvbakKind } from "./tables";
import { zipEntrySource } from "./zip-source";

const run = (bytes: Uint8Array) => importLumiverseArchive(zipEntrySource(bytes));

describe("buildMinimalLvbak: the full happy path", () => {
  test("all five kinds present, right counts, embedded book extracted, totals honest", async () => {
    const { entities, report } = await run(buildMinimalLvbak());

    expect(entities).toHaveLength(6); // 1 world_books lorebook + 1 embedded book + persona + character + preset + regex set
    expect(report.imported.character).toHaveLength(1);
    expect(report.imported.lorebook).toHaveLength(2);
    expect(report.imported.persona).toHaveLength(1);
    expect(report.imported.preset).toHaveLength(1);
    expect(report.imported.regex).toHaveLength(1);
    expect(report.failed).toEqual([]);

    const character = entities.find((e) => e.kind === "character");
    const embeddedBook = entities.find(
      (e) => e.kind === "lorebook" && e.body.name === "Test Character Alpha Embedded Book",
    );
    if (!character || character.kind !== "character") throw new Error("no character in the result");
    if (!embeddedBook || embeddedBook.kind !== "lorebook") throw new Error("no embedded book in the result");
    expect(character.body.knowledgeRefs).toEqual([embeddedBook.id]);

    const totals = reportTotals(report);
    expect(totals.imported).toBe(entities.length);
    expect(totals.failed).toBe(0);

    const bySkipped = new Map(report.skippedTables.map((s) => [s.table, s.rows]));
    expect(bySkipped.get("chats")).toBe(SKIPPED_TABLE_COUNTS.chats);
    expect(bySkipped.get("messages")).toBe(SKIPPED_TABLE_COUNTS.messages);
    expect(bySkipped.get("settings")).toBe(SKIPPED_TABLE_COUNTS.settings);
    expect(bySkipped.get("packs")).toBe(SKIPPED_TABLE_COUNTS.packs);
  });
});

describe("buildLegacyNoFormatVersionLvbak", () => {
  test("the 64 MiB legacy ceiling applies; the oversized description line survives", async () => {
    const { entities, report } = await run(buildLegacyNoFormatVersionLvbak());
    const character = entities.find((e) => e.kind === "character");
    if (!character || character.kind !== "character") throw new Error("no character in the result");
    expect((character.body.identity.description ?? "").length).toBeGreaterThan(4 * 1024 * 1024);
    expect(report.failed.filter((f) => f.table === "characters")).toEqual([]);
  });
});

describe("missing binaries import anyway, with precise records", () => {
  test("buildMissingBinariesLvbak: absent avatars/images are recorded, entities still import", async () => {
    const { entities, report } = await run(buildMissingBinariesLvbak());
    expect(entities.length).toBeGreaterThan(0);
    expect(report.missingBinaries).toContain(`files/avatars/${CHARACTER_AVATAR}`);
    expect(report.missingBinaries).toContain(`files/avatars/${PERSONA_AVATAR}`);
    expect(report.failed).toEqual([]);
  });

  test("buildIndirectBinaryLvbak: an avatar joined through images still resolves or misses precisely", async () => {
    const { entities, report } = await run(buildIndirectBinaryLvbak());
    const beta = entities.find((e) => e.kind === "character" && e.body.identity.name === "Test Character Beta");
    if (!beta || beta.kind !== "character") throw new Error("Test Character Beta missing from the result");
    expect(beta.body.media.portrait).toBeUndefined();
    expect(report.missingBinaries.some((p) => p.endsWith(".png") && p.includes("images"))).toBe(true);
  });

  test("buildCharacterGalleryLvbak: a missing gallery image is recorded, the character still imports", async () => {
    const { entities, report } = await run(buildCharacterGalleryLvbak());
    expect(entities.filter((e) => e.kind === "character")).toHaveLength(1);
    expect(report.missingBinaries).toContain(`files/images/${GALLERY_MISSING_IMAGE_FILENAME}`);
  });
});

describe("buildCrossLinksLvbak", () => {
  test("resolved links land on the canonical body; the dangling one is recorded, not thrown", async () => {
    const { entities, report } = await run(buildCrossLinksLvbak());
    const persona = entities.find((e) => e.kind === "persona");
    if (!persona || persona.kind !== "persona") throw new Error("no persona in the result");
    expect(persona.body.knowledgeRefs).toBeDefined();
    expect(persona.body.knowledgeRefs!.length).toBe(1);

    const unresolved = report.unresolvedLinks.find((l) => l.to === `characters/${DANGLING_ID}`);
    expect(unresolved).toBeDefined();
    expect(entities.length).toBeGreaterThan(0);
  });
});

describe("buildBadRowsLvbak: exact failed[] shapes, siblings imported", () => {
  test("one failure per broken row per table; every sibling row still imports", async () => {
    const { entities, report } = await run(buildBadRowsLvbak());

    const byTable = new Map(report.failed.map((f) => [f.table, f]));
    expect(report.failed).toHaveLength(3); // only the tables whose broken column is actually consumed gate
    expect(byTable.get("world_book_entries")).toMatchObject({ rowId: "lv-entry-000000000002" });
    expect(byTable.get("presets")).toMatchObject({ rowId: "lv-preset-000000000002", name: "Test Preset Broken" });
    expect(byTable.get("regex_scripts")).toMatchObject({ rowId: "lv-regex-000000000002", name: "Test Regex Broken" });

    // characters/personas/world_books never gate on their broken column (extensions/metadata/metadata);
    // both rows of each still import
    expect(entities.filter((e) => e.kind === "character")).toHaveLength(2);
    expect(entities.filter((e) => e.kind === "persona")).toHaveLength(2);
    expect(entities.filter((e) => e.kind === "lorebook" && e.body.name.startsWith("Test World Book"))).toHaveLength(2);
    // presets: only the valid one; the broken one gated before dispatch
    expect(entities.filter((e) => e.kind === "preset")).toHaveLength(1);
  });
});

describe("detection-boundary errors", () => {
  test("buildWrongProducerZip: a plain Error, not LvbakSchemaError", async () => {
    await expect(run(buildWrongProducerZip())).rejects.toBeInstanceOf(Error);
    await expect(run(buildWrongProducerZip())).rejects.not.toBeInstanceOf(LvbakSchemaError);
  });

  test("buildFutureSchemaLvbak: LvbakSchemaError naming the found schemaVersion", async () => {
    let caught: unknown;
    try {
      await run(buildFutureSchemaLvbak());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LvbakSchemaError);
    expect((caught as LvbakSchemaError).schemaVersion).toBe(2);
    expect((caught as LvbakSchemaError).message).toContain("2");
    expect((caught as LvbakSchemaError).message).toContain("1");
  });
});

describe("buildSecretsAndVectorsLvbak", () => {
  test("both standing warnings fire; nothing imports from the secrets/vector prefixes", async () => {
    const { entities, report } = await run(buildSecretsAndVectorsLvbak());
    expect(report.warnings.some((w) => w.includes("Encrypted API keys"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("Vector index data"))).toBe(true);
    // the mapped kinds still import normally; nothing named a secrets/vector table or entity exists
    expect(entities.length).toBeGreaterThan(0);
    expect(report.skippedTables.some((s) => s.table === "secrets" || s.table === "lancedb")).toBe(false);
  });
});

describe("buildHugeLorebookLvbak", () => {
  test("3 books, 1000 entries each, correctly grouped across an interleaved dump", async () => {
    const { entities, report } = await run(buildHugeLorebookLvbak());
    const books = entities.filter((e) => e.kind === "lorebook");
    expect(books).toHaveLength(3);
    for (const book of books) {
      if (book.kind !== "lorebook") throw new Error("unreachable");
      expect(book.body.entries).toHaveLength(1000);
    }
    expect(report.imported.lorebook).toHaveLength(3);
    for (const bookId of HUGE_LOREBOOK_BOOK_IDS) {
      expect(books.some((b) => b.kind === "lorebook" && b.body.name === `Huge Book ${HUGE_LOREBOOK_BOOK_IDS.indexOf(bookId) + 1}`)).toBe(true);
    }
  });
});

describe("zip vs directory: same bytes, same result", () => {
  test("buildMinimalLvbak produces deep-equal entities and report through either source", async () => {
    const bytes = buildMinimalLvbak();
    const zipResult = await importLumiverseArchive(zipEntrySource(bytes));

    const root = await materializeLvbak(bytes);
    try {
      const dirResult = await importLumiverseArchive(directoryEntrySource(root));
      // No normalization needed: table content is read by NAME (entryNameForTable), never by listing
      // position, and skippedTables is sorted by planTableWalk regardless of source. Verified by hand
      // first (a throwaway script comparing JSON.stringify of both results) before writing this as a
      // real assertion, so this is a known-true claim, not an optimistic one.
      expect(dirResult).toEqual(zipResult);
    } finally {
      await removeMaterialized(root);
    }
  });
});

describe("universal escrow assertions across the minimal run", () => {
  test("every entity's first original entry is a codec twin; every archive twin carries raw inner-JSON strings", async () => {
    const { entities } = await run(buildMinimalLvbak());
    expect(entities.length).toBeGreaterThan(0);

    for (const entity of entities) {
      const original = entity.original;
      expect(original).toBeDefined();
      const keys = Object.keys(original!);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).not.toBe("lumiverse-archive");

      const archived = original!["lumiverse-archive"];
      if (!archived) {
        // The one documented exception: an embedded character_book has no row of its own to escrow.
        expect(entity.kind).toBe("lorebook");
        expect(keys).toEqual(["character-book"]);
        continue;
      }

      const raw = archived.raw as Record<string, unknown>;
      const table = (archived.unmapped as { table?: string } | undefined)?.table;
      expect(table).toBeDefined();
      // Spot-check one JSON-string column per table, still its raw doubly-encoded string form.
      if (table === "world_books") {
        const book = (raw as { book: Record<string, unknown> }).book;
        expect(typeof book.metadata).toBe("string");
        const entries = (raw as { entries: Record<string, unknown>[] }).entries;
        if (entries.length > 0) expect(typeof entries[0]!.key).toBe("string");
      } else if (table === "personas") {
        expect(typeof raw.metadata).toBe("string");
      } else if (table === "characters") {
        expect(typeof raw.extensions).toBe("string");
      } else if (table === "presets") {
        expect(typeof raw.prompts).toBe("string");
      } else if (table === "regex_scripts") {
        const rows = (raw as { rows: Record<string, unknown>[] }).rows;
        expect(rows.length).toBeGreaterThan(0);
        expect(typeof rows[0]!.placement).toBe("string");
      }
    }
  });
});

describe("bounds abort: a container-level limit breach aborts the whole archive", () => {
  test("reviewer's repro: a maxAggregateOriginal below what buildMinimalLvbak needs throws, never a partial import", async () => {
    // Deliberately below the fixture's own decompressed total (~5.8 KiB across manifest, both
    // manifests, and every table/binary), so SOME read past detection is guaranteed to breach it.
    // Before M10, the per-row catches in every kind module swallowed this into a clean-looking
    // recordFailure instead of aborting, which is exactly the bug this pins.
    const source = zipEntrySource(buildMinimalLvbak(), { ...LVBAK_ARCHIVE_BOUNDS, maxAggregateOriginal: 1000 });
    let caught: unknown;
    try {
      await importLumiverseArchive(source);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(isArchiveLimitError(caught)).toBe(true);
  });
});

describe("unique ids: same-named entities never collide in the link map", () => {
  test("two same-named characters, two same-named books, two personas each attached to a different book: no cross-wiring", async () => {
    const tables = {
      characters: [
        characterRow({ id: "lv-char-a", name: "Aria", extensions: "{}", avatar_path: null, image_id: null, avatar_crop_image_id: null }),
        characterRow({ id: "lv-char-b", name: "Aria", extensions: "{}", avatar_path: null, image_id: null, avatar_crop_image_id: null }),
      ],
      world_books: [
        worldBookRow({ id: "lv-book-a", name: "Shared Book" }),
        worldBookRow({ id: "lv-book-b", name: "Shared Book" }),
      ],
      personas: [
        personaRow({ id: "lv-persona-a", name: "P1", attached_world_book_id: "lv-book-a", avatar_path: null }),
        personaRow({ id: "lv-persona-b", name: "P2", attached_world_book_id: "lv-book-b", avatar_path: null }),
      ],
    };
    const bytes = assembleLvbak({ manifest: lvbakManifest(), tables, stats: lvbakStats(tables) });
    const { entities } = await run(bytes);

    const characters = entities.filter((e) => e.kind === "character");
    expect(characters).toHaveLength(2);
    expect(new Set(characters.map((c) => c.id)).size).toBe(2);

    const books = entities.filter((e) => e.kind === "lorebook");
    expect(books).toHaveLength(2);
    expect(new Set(books.map((b) => b.id)).size).toBe(2);

    const rawId = (e: (typeof books)[number]): unknown =>
      (e.original!["lumiverse-archive"]!.raw as { book: { id: unknown } }).book.id;
    const bookA = books.find((b) => rawId(b) === "lv-book-a")!;
    const bookB = books.find((b) => rawId(b) === "lv-book-b")!;
    expect(bookA).toBeDefined();
    expect(bookB).toBeDefined();
    expect(bookA.id).not.toBe(bookB.id);

    const personas = entities.filter((e) => e.kind === "persona");
    const p1 = personas.find((p) => p.kind === "persona" && p.body.name === "P1")!;
    const p2 = personas.find((p) => p.kind === "persona" && p.body.name === "P2")!;
    if (p1.kind !== "persona" || p2.kind !== "persona") throw new Error("unreachable");
    // each persona's knowledgeRefs names its OWN book's id, not whichever same-named book recorded last
    expect(p1.body.knowledgeRefs).toEqual([bookA.id]);
    expect(p2.body.knowledgeRefs).toEqual([bookB.id]);
  });
});

describe("integer primary keys: an archive whose ids are numbers, not strings", () => {
  test("portrait (image_id and avatar_crop_image_id), knowledgeRefs, and regex scope all still resolve", async () => {
    const tables = {
      characters: [
        characterRow({
          id: 100,
          name: "Char A",
          extensions: "{}",
          avatar_path: null,
          image_id: 10,
          avatar_crop_image_id: null,
        }),
        characterRow({
          id: 101,
          name: "Char B",
          extensions: "{}",
          avatar_path: null,
          image_id: 999, // no such images row: this character's join has to fall through to the crop id
          avatar_crop_image_id: 20,
        }),
      ],
      images: [
        imageRow({ id: 10, filename: "image-a.png", character_id: 100 }),
        imageRow({ id: 20, filename: "image-b.png", character_id: 101 }),
      ],
      world_books: [worldBookRow({ id: 5, name: "Integer PK Book" })],
      personas: [personaRow({ id: 200, name: "P", attached_world_book_id: 5, avatar_path: null })],
      regex_scripts: [regexScriptRow({ id: 300, scope: "character", scope_id: 100 })],
    };
    const bytes = assembleLvbak({
      manifest: lvbakManifest(),
      tables,
      files: {
        "files/images/image-a.png": PNG_1X1,
        "files/images/image-b.png": PNG_1X1,
      },
      stats: lvbakStats(tables),
    });
    const { entities, report } = await run(bytes);
    expect(report.failed).toEqual([]);

    const charA = entities.find((e) => e.kind === "character" && e.body.identity.name === "Char A");
    const charB = entities.find((e) => e.kind === "character" && e.body.identity.name === "Char B");
    if (!charA || charA.kind !== "character") throw new Error("Char A missing from the result");
    if (!charB || charB.kind !== "character") throw new Error("Char B missing from the result");
    // image_id: 10 (a number, not a string) still joins to its images row
    expect(charA.body.media.portrait?.ref.startsWith("data:image/png;base64,")).toBe(true);
    // image_id: 999 misses, but avatar_crop_image_id: 20 (also a number) still joins
    expect(charB.body.media.portrait?.ref.startsWith("data:image/png;base64,")).toBe(true);

    const persona = entities.find((e) => e.kind === "persona");
    if (!persona || persona.kind !== "persona") throw new Error("no persona in the result");
    const book = entities.find((e) => e.kind === "lorebook");
    if (!book) throw new Error("no lorebook in the result");
    // attached_world_book_id: 5 (a number) still resolves through the link map
    expect(persona.body.knowledgeRefs).toEqual([book.id]);

    const regex = entities.find((e) => e.kind === "regex");
    if (!regex || regex.kind !== "regex") throw new Error("no regex set in the result");
    // scope_id: 100 (a number) still resolves the scope target's name
    expect(regex.body.name).toBe("Char A regex");
  });
});

describe("IMPORT_STAGE_ORDER", () => {
  test("matches the kind order MAPPED_TABLES/TABLE_KINDS implies, so the two can never silently drift apart", () => {
    const derived: LvbakKind[] = [];
    for (const table of MAPPED_TABLES) {
      const kind = TABLE_KINDS[table];
      if (kind && !derived.includes(kind)) derived.push(kind);
    }
    expect(IMPORT_STAGE_ORDER).toEqual(derived);
  });
});

describe("parse-only: no filesystem writes", () => {
  test("import.ts's own source never imports a write-capable node:fs function", async () => {
    // Structural check: cheap, catches an accidentally-added write call at the source level.
    const text = await Bun.file(new URL("./import.ts", import.meta.url)).text();
    expect(text).not.toMatch(/writeFile|mkdir|rmdir|unlink|rm\(/);
  });

  test("a directory-backed archive's own tree is byte-for-byte unchanged after import", async () => {
    // Runtime check: materialize a real directory, snapshot every file's name AND content before and
    // after import, and assert nothing was added, removed, or modified. Stronger than the structural
    // check above because it would catch a write to ANY path the importer happened to be handed,
    // not just a literal `writeFile` call this repo's own code makes directly.
    const root = await materializeLvbak(buildMinimalLvbak());
    try {
      const before = await snapshotTree(root);
      await importLumiverseArchive(directoryEntrySource(root));
      const after = await snapshotTree(root);
      expect(after).toEqual(before);
    } finally {
      await removeMaterialized(root);
    }
  });
});

/** Path + content hash per file, so a same-name file rewritten in place is caught too. */
async function snapshotTree(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  const snapshots = await Promise.all(
    files.map(async (e) => {
      const relative = `${e.parentPath}/${e.name}`.slice(root.length);
      const digest = new Bun.CryptoHasher("sha256").update(await Bun.file(`${e.parentPath}/${e.name}`).bytes()).digest("hex");
      return `${relative}:${digest}`;
    }),
  );
  return snapshots.sort();
}
