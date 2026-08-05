/**
 * Ground truth for the .lvbak fixture toolkit: every builder must produce an archive that a normal
 * ZIP reader can open, in real-export entry order, with the compression methods and row shapes the
 * spec claims. If these drift, every test built on the fixtures is measuring the wrong thing.
 */
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import {
  GALLERY_MISSING_IMAGE_FILENAME,
  GALLERY_MISSING_IMAGE_ID,
  GALLERY_RESOLVABLE_IMAGE_FILENAME,
  GALLERY_RESOLVABLE_IMAGE_ID,
  INDIRECT_MISSING_IMAGE_FILENAME,
  INDIRECT_MISSING_IMAGE_ID,
  PNG_1X1,
  SKIPPED_TABLE_COUNTS,
  buildBadRowsLvbak,
  buildCharacterGalleryLvbak,
  buildCrossLinksLvbak,
  buildFutureSchemaLvbak,
  buildIndirectBinaryLvbak,
  buildLegacyNoFormatVersionLvbak,
  buildMinimalLvbak,
  buildMissingBinariesLvbak,
  buildSecretsAndVectorsLvbak,
  buildWrongProducerZip,
} from "./build-lvbak";
import { materializeLvbak, removeMaterialized } from "./materialize";
import {
  CHARACTER_AVATAR,
  CHARACTER_ID,
  DANGLING_ID,
  IMAGE_ID,
  PERSONA_AVATAR,
  PRESET_ID,
  WORLD_BOOK_ID,
} from "./rows";

const STORED = 0;
const DEFLATE = 8;

interface Listed {
  name: string;
  compression: number;
  originalSize: number;
}

/** Entry metadata in archive order. The filter returns false, so nothing is inflated. */
const listing = (bytes: Uint8Array): Listed[] => {
  const seen: Listed[] = [];
  unzipSync(bytes, {
    filter: (f) => {
      seen.push({ name: f.name, compression: f.compression, originalSize: f.originalSize });
      return false;
    },
  });
  return seen;
};

const text = (bytes: Uint8Array, name: string): string => {
  const entry = unzipSync(bytes, { filter: (f) => f.name === name })[name];
  if (!entry) throw new Error(`fixture is missing entry ${name}`);
  return strFromU8(entry);
};

const json = (bytes: Uint8Array, name: string): Record<string, unknown> =>
  JSON.parse(text(bytes, name)) as Record<string, unknown>;

const rows = (bytes: Uint8Array, table: string): Record<string, unknown>[] => {
  const raw = text(bytes, `database/${table}.ndjson`);
  if (raw === "") return [];
  return raw
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
};

const inner = (row: Record<string, unknown>, column: string): unknown =>
  JSON.parse(row[column] as string);

const parses = (row: Record<string, unknown>, column: string): boolean => {
  try {
    inner(row, column);
    return true;
  } catch {
    return false;
  }
};

describe("lvbak fixture layout", () => {
  test("minimal: manifest first, manifest-stats last, expected entries between", () => {
    const names = listing(buildMinimalLvbak()).map((e) => e.name);
    expect(names[0]).toBe("manifest.json");
    expect(names[names.length - 1]).toBe("manifest-stats.json");
    expect(names).toContain("database/characters.ndjson");
    expect(names).toContain("database/world_books.ndjson");
    expect(names).toContain("database/world_book_entries.ndjson");
    expect(names).toContain("database/presets.ndjson");
    expect(names).toContain("database/personas.ndjson");
    expect(names).toContain("database/regex_scripts.ndjson");
    expect(names).toContain(`files/avatars/${CHARACTER_AVATAR}`);
    expect(names).toContain(`files/avatars/${PERSONA_AVATAR}`);
    // database entries precede the files tree, the order a real export writes
    const lastDb = names.findLastIndex((n) => n.startsWith("database/"));
    const firstFile = names.findIndex((n) => n.startsWith("files/"));
    expect(lastDb).toBeLessThan(firstFile);
  });

  test("minimal: NDJSON deflates, binaries are stored", () => {
    for (const entry of listing(buildMinimalLvbak())) {
      const expected = entry.name.startsWith("files/") ? STORED : DEFLATE;
      expect([entry.name, entry.compression]).toEqual([entry.name, expected]);
    }
  });

  test("builds are byte stable", () => {
    expect(buildMinimalLvbak()).toEqual(buildMinimalLvbak());
    expect(buildCrossLinksLvbak()).toEqual(buildCrossLinksLvbak());
  });

  test("minimal: manifest placeholders are empty, stats carry the real counts", () => {
    const bytes = buildMinimalLvbak();
    const manifest = json(bytes, "manifest.json");
    expect(manifest.producer).toBe("lumiverse");
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.ndjsonFormatVersion).toBe(1);
    expect(manifest.counts).toEqual({});
    expect(manifest.missingFiles).toEqual([]);

    const stats = json(bytes, "manifest-stats.json");
    const counts = stats.counts as Record<string, number>;
    expect(counts.characters).toBe(1);
    expect(counts.world_book_entries).toBe(1);
    // skipped tables are counted too, so the report can name what did not come along
    expect(counts.chats).toBe(SKIPPED_TABLE_COUNTS.chats);
    expect(stats.missingFiles).toEqual([]);
  });
});

describe("lvbak fixture rows", () => {
  const bytes = buildMinimalLvbak();

  test("character row is flattened CCv2 plus an extensions JSON string", () => {
    const row = rows(bytes, "characters")[0]!;
    expect(row.id).toBe(CHARACTER_ID);
    expect(row.name).toBe("Test Character Alpha");
    expect(typeof row.first_mes).toBe("string");
    expect(typeof row.extensions).toBe("string");
    const ext = inner(row, "extensions") as Record<string, Record<string, unknown>>;
    expect(ext.lumiverse_modules!.expressions).toBeDefined();
    expect(ext.lumiverse_modules!.regex_scripts).toBeDefined();
    expect(ext.character_book!.name).toBe("Test Character Alpha Embedded Book");
    expect(ext.chub).toBeDefined();
    expect(inner(row, "tags")).toEqual(["fixture", "synthetic"]);
    expect(inner(row, "alternate_greetings")).toHaveLength(1);
  });

  test("world book entry joins its parent and carries key as a JSON string", () => {
    const entry = rows(bytes, "world_book_entries")[0]!;
    expect(entry.world_book_id).toBe(WORLD_BOOK_ID);
    expect(typeof entry.key).toBe("string");
    expect(inner(entry, "key")).toEqual(["alpha", "test alpha"]);
    // booleans are SQLite integers, which row to wire synthesis has to coerce
    expect(entry.constant).toBe(0);
    expect(entry.selective).toBe(1);
  });

  test("preset row is the inner block model, not the file wrapper", () => {
    const preset = rows(bytes, "presets")[0]!;
    expect(preset.id).toBe(PRESET_ID);
    const prompts = inner(preset, "prompts") as Record<string, unknown>;
    expect(Object.keys(prompts)).toEqual(["blk-main", "blk-post-history"]);
    const order = inner(preset, "prompt_order") as Array<Record<string, unknown>>;
    expect(order.map((o) => o.position)).toEqual(["pre_history", "depth"]);
    expect(order[1]!.injectionTrigger).toEqual(["normal"]);
    const parameters = inner(preset, "parameters") as Record<string, unknown>;
    expect(parameters.customBody).toBeDefined();
    expect(parameters.samplerOverrides).toBeDefined();
    // no wrapper anywhere in the row: synthesizing one is the preset slice's job
    expect(preset.type).toBeUndefined();
    expect(preset.blocks).toBeUndefined();
  });

  test("persona row carries the pronoun triplet the codec detects on", () => {
    const persona = rows(bytes, "personas")[0]!;
    expect(persona.subjective_pronoun).toBe("they");
    expect(persona.objective_pronoun).toBe("them");
    expect(persona.possessive_pronoun).toBe("their");
    expect(persona.avatar_path).toBe(PERSONA_AVATAR);
    expect(persona.attached_world_book_id).toBeNull();
  });

  test("regex row carries placement, target, and actions as JSON strings", () => {
    const rule = rows(bytes, "regex_scripts")[0]!;
    expect(inner(rule, "placement")).toEqual(["user_input", "ai_output"]);
    expect(inner(rule, "target")).toEqual(["prompt", "display"]);
    expect(inner(rule, "actions")).toHaveLength(1);
    expect(rule.disabled).toBe(0);
  });
});

describe("lvbak fixture variants", () => {
  test("legacy archive drops ndjsonFormatVersion and holds a line past 4 MiB", () => {
    const bytes = buildLegacyNoFormatVersionLvbak();
    expect("ndjsonFormatVersion" in json(bytes, "manifest.json")).toBe(false);
    const line = text(bytes, "database/characters.ndjson");
    expect(line.length).toBeGreaterThan(4 * 1024 * 1024);
    expect(line.length).toBeLessThan(64 * 1024 * 1024);
  });

  test("missing binaries: no files tree, stats name what is gone", () => {
    const bytes = buildMissingBinariesLvbak();
    expect(listing(bytes).filter((e) => e.name.startsWith("files/"))).toHaveLength(0);
    const missing = json(bytes, "manifest-stats.json").missingFiles as string[];
    expect(missing).toContain(`files/avatars/${CHARACTER_AVATAR}`);
    expect(missing).toHaveLength(3);
    // the rows still reference the absent avatar, which is what makes the warning path testable
    expect(rows(bytes, "characters")[0]!.avatar_path).toBe(CHARACTER_AVATAR);
  });

  test("cross links resolve to real rows except the one that dangles", () => {
    const bytes = buildCrossLinksLvbak();
    expect(rows(bytes, "personas")[0]!.attached_world_book_id).toBe(WORLD_BOOK_ID);
    const scripts = rows(bytes, "regex_scripts");
    expect(scripts).toHaveLength(3);
    expect(scripts[0]!.character_id).toBe(CHARACTER_ID);
    expect(scripts[1]!.preset_id).toBe(PRESET_ID);
    expect(scripts[2]!.character_id).toBe(DANGLING_ID);
    const known = new Set(rows(bytes, "characters").map((r) => r.id));
    expect(known.has(DANGLING_ID)).toBe(false);
  });

  test("bad rows: exactly one unparseable inner JSON per table, siblings intact", () => {
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
      const table_rows = rows(bytes, table);
      expect([table, table_rows.length]).toEqual([table, 2]);
      expect([table, parses(table_rows[0]!, column)]).toEqual([table, true]);
      expect([table, parses(table_rows[1]!, column)]).toEqual([table, false]);
      // the row itself is valid JSON: only the doubly encoded string is broken
      expect([table, typeof table_rows[1]!.id]).toEqual([table, "string"]);
    }
  });

  test("indirect binaries: avatars resolve through images, one file present and one absent", () => {
    const bytes = buildIndirectBinaryLvbak();
    const chars = rows(bytes, "characters");
    expect(chars).toHaveLength(2);
    expect(chars[0]!.avatar_path).toBeNull();
    expect(chars[0]!.image_id).toBe(IMAGE_ID);
    expect(chars[1]!.avatar_crop_image_id).toBe(INDIRECT_MISSING_IMAGE_ID);
    const images = rows(bytes, "images");
    expect(images.map((r) => r.id)).toEqual([IMAGE_ID, INDIRECT_MISSING_IMAGE_ID]);
    // the first image's file rides along with the standard set, the second never does
    const names = listing(bytes).map((e) => e.name);
    expect(names).not.toContain(`files/images/${INDIRECT_MISSING_IMAGE_FILENAME}`);
    const missing = json(bytes, "manifest-stats.json").missingFiles as string[];
    expect(missing).toEqual([`files/images/${INDIRECT_MISSING_IMAGE_FILENAME}`]);
  });

  test("character gallery: two rows written out of sort_order, one resolvable and one not", () => {
    const bytes = buildCharacterGalleryLvbak();
    const gallery = rows(bytes, "character_gallery");
    expect(gallery).toHaveLength(2);
    // written with sort_order 1 first, proving the importer's own order has to sort, not trust this
    expect(gallery[0]!.sort_order).toBe(1);
    expect(gallery[0]!.image_id).toBe(GALLERY_MISSING_IMAGE_ID);
    expect(gallery[1]!.sort_order).toBe(0);
    expect(gallery[1]!.image_id).toBe(GALLERY_RESOLVABLE_IMAGE_ID);
    // no columns beyond the four join-essential ones
    for (const row of gallery) {
      expect(Object.keys(row).sort()).toEqual(["character_id", "id", "image_id", "sort_order"]);
    }

    const names = listing(bytes).map((e) => e.name);
    expect(names).toContain(`files/images/${GALLERY_RESOLVABLE_IMAGE_FILENAME}`);
    expect(names).not.toContain(`files/images/${GALLERY_MISSING_IMAGE_FILENAME}`);
    const missing = json(bytes, "manifest-stats.json").missingFiles as string[];
    expect(missing).toEqual([`files/images/${GALLERY_MISSING_IMAGE_FILENAME}`]);
  });

  test("wrong producer keeps the layout but fails the producer check", () => {
    const bytes = buildWrongProducerZip();
    expect(json(bytes, "manifest.json").producer).toBe("someone-else");
    expect(listing(bytes).map((e) => e.name)).toContain("database/characters.ndjson");
  });

  test("future schema declares a version we do not accept", () => {
    expect(json(buildFutureSchemaLvbak(), "manifest.json").schemaVersion).toBe(2);
  });

  test("secrets and vectors archive flags both and carries their entries", () => {
    const bytes = buildSecretsAndVectorsLvbak();
    const manifest = json(bytes, "manifest.json");
    expect(manifest.hasEncryptedSecrets).toBe(true);
    expect(manifest.includeVectors).toBe(true);
    const names = listing(bytes).map((e) => e.name);
    expect(names.some((n) => n.startsWith("secrets/"))).toBe(true);
    expect(names.filter((n) => n.startsWith("lancedb/"))).toHaveLength(2);
  });
});

describe("materializeLvbak", () => {
  test("unpacks an archive into a directory with identical bytes", async () => {
    const bytes = buildMinimalLvbak();
    const root = await materializeLvbak(bytes);
    try {
      const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as {
        producer: string;
      };
      expect(manifest.producer).toBe("lumiverse");
      const avatar = await readFile(join(root, "files", "avatars", CHARACTER_AVATAR));
      expect(new Uint8Array(avatar)).toEqual(PNG_1X1);
      const ndjson = await readFile(join(root, "database", "characters.ndjson"), "utf8");
      expect(ndjson).toBe(text(bytes, "database/characters.ndjson"));
    } finally {
      await removeMaterialized(root);
    }
  });
});
