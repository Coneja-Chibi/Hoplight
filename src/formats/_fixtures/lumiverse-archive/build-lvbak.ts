/**
 * Builders for the .lvbak fixtures named in specs/formats/lumiverse-archive.md, Test plan. Each
 * returns a finished archive as bytes, built through the ZIP64 writer so the fixtures carry the
 * ZIP64 structures Lumiverse's forceZip64 export always writes.
 *
 * Layout matches a real export: manifest.json first, then database/{table}.ndjson (DEFLATE), then
 * the files/ tree (STORED), then manifest-stats.json last. All content is synthetic.
 */
import {
  ZIP_DEFLATE,
  ZIP_STORED,
  writeZip64,
  type Zip64EntryInput,
} from "./zip64-writer";
import {
  CHARACTER_AVATAR,
  CHARACTER_ID,
  DANGLING_ID,
  IMAGE_FILENAME,
  IMAGE_ID,
  PERSONA_AVATAR,
  PRESET_ID,
  WORLD_BOOK_ID,
  characterRow,
  imageRow,
  personaRow,
  presetRow,
  regexScriptRow,
  worldBookEntryRow,
  worldBookRow,
  type LvbakRow,
} from "./rows";

const encoder = new TextEncoder();

/** A 1x1 PNG. Real, decodable, and the smallest honest stand-in for an avatar. */
export const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

/**
 * A 34 byte RIFF/WEBP container holding one VP8L chunk, standing in for a thumbnail. The container
 * framing is what these fixtures exercise; nothing in the suite decodes the pixels.
 */
export const WEBP_STUB = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
  0x0d, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe,
  0x07, 0x00,
]);

/** Tables the importer maps, in the order a fixture writes them. */
const TABLE_ORDER = [
  "characters",
  "world_books",
  "world_book_entries",
  "presets",
  "personas",
  "regex_scripts",
  "images",
];

/**
 * Row counts for tables the importer skips by name. Real exports carry these in manifest-stats and
 * the report quotes them, so nobody believes chats came along.
 */
export const SKIPPED_TABLE_COUNTS: Record<string, number> = {
  chats: 3,
  messages: 12,
  settings: 1,
  packs: 2,
};

const EXPORTED_AT = "2026-01-01T00:00:00.000Z";

const ndjson = (rows: readonly LvbakRow[]): string =>
  rows.length === 0 ? "" : `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;

const textEntry = (name: string, text: string): Zip64EntryInput => ({
  name,
  data: encoder.encode(text),
  method: ZIP_DEFLATE,
  level: 3,
});

export interface LvbakManifestOverrides {
  [field: string]: unknown;
}

/** The manifest a real export writes: counts and missingFiles are placeholders, never trusted. */
export const lvbakManifest = (over: LvbakManifestOverrides = {}): Record<string, unknown> => ({
  schemaVersion: 1,
  producer: "lumiverse",
  ndjsonFormatVersion: 1,
  exportedAt: EXPORTED_AT,
  hasEncryptedSecrets: false,
  includeVectors: false,
  counts: {},
  missingFiles: [],
  ...over,
});

/** manifest-stats.json: the real per-table counts plus the files rows reference but disk lacks. */
export const lvbakStats = (
  tables: Record<string, readonly LvbakRow[]>,
  missingFiles: readonly string[] = [],
): Record<string, unknown> => ({
  counts: {
    ...Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])),
    ...SKIPPED_TABLE_COUNTS,
  },
  missingFiles: [...missingFiles],
});

export interface LvbakParts {
  manifest: Record<string, unknown>;
  tables: Record<string, readonly LvbakRow[]>;
  /** Full entry names to STORED bytes, for example "files/avatars/test-character-alpha.png". */
  files?: Record<string, Uint8Array>;
  /** Anything outside the standard layout, such as lancedb/ or secrets/ entries. */
  extras?: readonly Zip64EntryInput[];
  /** manifest-stats.json content, or null to omit the entry entirely. */
  stats?: Record<string, unknown> | null;
}

const orderedTables = (tables: Record<string, readonly LvbakRow[]>): string[] => {
  const known = TABLE_ORDER.filter((t) => t in tables);
  const rest = Object.keys(tables)
    .filter((t) => !TABLE_ORDER.includes(t))
    .sort();
  return [...known, ...rest];
};

/** Assemble parts into a finished archive, in real-export entry order. */
export function assembleLvbak(parts: LvbakParts): Uint8Array {
  const entries: Zip64EntryInput[] = [textEntry("manifest.json", JSON.stringify(parts.manifest, null, 2))];
  for (const table of orderedTables(parts.tables)) {
    entries.push(textEntry(`database/${table}.ndjson`, ndjson(parts.tables[table]!)));
  }
  for (const [name, data] of Object.entries(parts.files ?? {})) {
    entries.push({ name, data, method: ZIP_STORED });
  }
  entries.push(...(parts.extras ?? []));
  if (parts.stats) {
    entries.push(textEntry("manifest-stats.json", JSON.stringify(parts.stats, null, 2)));
  }
  return writeZip64(entries);
}

/** The binaries the standard rows reference: both avatars, the image, and its two thumbnails. */
export const standardFiles = (): Record<string, Uint8Array> => ({
  [`files/avatars/${CHARACTER_AVATAR}`]: PNG_1X1,
  [`files/avatars/${PERSONA_AVATAR}`]: PNG_1X1,
  [`files/images/${IMAGE_FILENAME}`]: PNG_1X1,
  [`files/thumbnails/${IMAGE_ID}_thumb_sm_v2.webp`]: WEBP_STUB,
  [`files/thumbnails/${IMAGE_ID}_thumb_lg_v2.webp`]: WEBP_STUB,
});

const standardTables = (): Record<string, LvbakRow[]> => ({
  characters: [characterRow()],
  world_books: [worldBookRow()],
  world_book_entries: [worldBookEntryRow()],
  presets: [presetRow()],
  personas: [personaRow()],
  regex_scripts: [regexScriptRow()],
  images: [imageRow()],
});

/** Happy path: one row of each mapped kind, every referenced binary present, stats included. */
export function buildMinimalLvbak(): Uint8Array {
  const tables = standardTables();
  return assembleLvbak({
    manifest: lvbakManifest(),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/** Roughly 4.5 MiB of one repeated sentence, so a single NDJSON line clears the 4 MiB ceiling. */
const longFieldValue = (): string => {
  const unit = "Synthetic padding sentence for the legacy line ceiling. ";
  return unit.repeat(Math.ceil((4.5 * 1024 * 1024) / unit.length));
};

/**
 * Legacy archive: no ndjsonFormatVersion, so the reader must tolerate lines up to 64 MiB. Carries
 * one line past 4 MiB to prove the strict ceiling would have rejected it.
 */
export function buildLegacyNoFormatVersionLvbak(): Uint8Array {
  const manifest = lvbakManifest();
  delete manifest.ndjsonFormatVersion;
  const tables = {
    ...standardTables(),
    characters: [characterRow({ description: longFieldValue() })],
  };
  return assembleLvbak({
    manifest,
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/** Avatar and image references with no files/ entries behind them. Entities import, warnings fire. */
export function buildMissingBinariesLvbak(): Uint8Array {
  const tables = standardTables();
  return assembleLvbak({
    manifest: lvbakManifest(),
    tables,
    files: {},
    stats: lvbakStats(tables, [
      `files/avatars/${CHARACTER_AVATAR}`,
      `files/avatars/${PERSONA_AVATAR}`,
      `files/images/${IMAGE_FILENAME}`,
    ]),
  });
}

/** Cross-references that must resolve through the id map, plus one that cannot. */
export function buildCrossLinksLvbak(): Uint8Array {
  const tables: Record<string, LvbakRow[]> = {
    ...standardTables(),
    personas: [personaRow({ attached_world_book_id: WORLD_BOOK_ID })],
    regex_scripts: [
      regexScriptRow({ scope: "character", scope_id: CHARACTER_ID, character_id: CHARACTER_ID }),
      regexScriptRow({
        id: "lv-regex-000000000002",
        name: "Test Regex Beta",
        scope: "preset",
        scope_id: PRESET_ID,
        preset_id: PRESET_ID,
      }),
      regexScriptRow({
        id: "lv-regex-000000000003",
        name: "Test Regex Dangling",
        scope: "character",
        scope_id: DANGLING_ID,
        character_id: DANGLING_ID,
      }),
    ],
  };
  return assembleLvbak({
    manifest: lvbakManifest(),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/** A truncated inner-JSON string per table, among valid rows. Pins per-row isolation. */
export function buildBadRowsLvbak(): Uint8Array {
  const tables: Record<string, LvbakRow[]> = {
    characters: [
      characterRow(),
      characterRow({
        id: "lv-char-000000000002",
        name: "Test Character Broken",
        extensions: '{"lumiverse_modules": {"expressions":',
      }),
    ],
    world_books: [
      worldBookRow(),
      worldBookRow({
        id: "lv-book-000000000002",
        name: "Test World Book Broken",
        metadata: '{"source": ',
      }),
    ],
    world_book_entries: [
      worldBookEntryRow(),
      worldBookEntryRow({ id: "lv-entry-000000000002", key: '["alpha"' }),
    ],
    presets: [
      presetRow(),
      presetRow({
        id: "lv-preset-000000000002",
        name: "Test Preset Broken",
        prompts: '{"blk-main":',
      }),
    ],
    personas: [
      personaRow(),
      personaRow({
        id: "lv-persona-000000000002",
        name: "Test Persona Broken",
        is_default: 0,
        metadata: '{"source"',
      }),
    ],
    regex_scripts: [
      regexScriptRow(),
      regexScriptRow({
        id: "lv-regex-000000000002",
        name: "Test Regex Broken",
        placement: '["user_input"',
      }),
    ],
    images: [imageRow()],
  };
  return assembleLvbak({
    manifest: lvbakManifest(),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/** The second character's avatar_crop_image_id joins an images row whose file never lands in files/. */
export const INDIRECT_MISSING_IMAGE_ID = "lv-image-000000000002";
export const INDIRECT_MISSING_IMAGE_FILENAME = "test-image-beta.png";

/**
 * Two characters that resolve their avatar through the images table rather than avatar_path: the
 * first's image_id joins a row whose file is present, the second's avatar_crop_image_id joins a row
 * whose file is absent. Exercises the join half of files/ resolution (spec Behavior step 4), which a
 * direct avatar_path reference never touches.
 */
export function buildIndirectBinaryLvbak(): Uint8Array {
  const tables: Record<string, LvbakRow[]> = {
    ...standardTables(),
    characters: [
      characterRow({ avatar_path: null, image_id: IMAGE_ID, avatar_crop_image_id: null }),
      characterRow({
        id: "lv-char-000000000002",
        name: "Test Character Beta",
        avatar_path: null,
        image_id: null,
        avatar_crop_image_id: INDIRECT_MISSING_IMAGE_ID,
      }),
    ],
    images: [
      imageRow(),
      imageRow({
        id: INDIRECT_MISSING_IMAGE_ID,
        filename: INDIRECT_MISSING_IMAGE_FILENAME,
        character_id: "lv-char-000000000002",
      }),
    ],
  };
  return assembleLvbak({
    manifest: lvbakManifest(),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables, [`files/images/${INDIRECT_MISSING_IMAGE_FILENAME}`]),
  });
}

/** The three books buildHugeLorebookLvbak interleaves entries across. */
export const HUGE_LOREBOOK_BOOK_IDS = ["lv-book-huge-1", "lv-book-huge-2", "lv-book-huge-3"] as const;
const HUGE_LOREBOOK_ENTRIES_PER_BOOK = 1000;

/**
 * Three books, a few thousand entries between them, written round-robin (book1 entry0, book2
 * entry0, book3 entry0, book1 entry1, ...) rather than grouped. A real SQLite dump gives no ORDER BY
 * guarantee, so this is what "no contiguity" actually looks like: proves the join groups by
 * world_book_id in one pass over the entries table, not by watching for the id to change.
 */
export function buildHugeLorebookLvbak(): Uint8Array {
  const books = HUGE_LOREBOOK_BOOK_IDS.map((id, i) => worldBookRow({ id, name: `Huge Book ${i + 1}` }));
  const entries: LvbakRow[] = [];
  for (let n = 0; n < HUGE_LOREBOOK_ENTRIES_PER_BOOK; n++) {
    for (const bookId of HUGE_LOREBOOK_BOOK_IDS) {
      entries.push(
        worldBookEntryRow({
          id: `lv-entry-${bookId}-${n}`,
          world_book_id: bookId,
          key: JSON.stringify([`${bookId}-key-${n}`]),
          comment: `${bookId} entry ${n}`,
          order_value: n,
        }),
      );
    }
  }
  const tables: Record<string, LvbakRow[]> = { world_books: books, world_book_entries: entries };
  return assembleLvbak({ manifest: lvbakManifest(), tables, stats: lvbakStats(tables) });
}

/** Valid layout, wrong producer. Detection must fall through to charx or bundle handling. */
export function buildWrongProducerZip(): Uint8Array {
  const tables = standardTables();
  return assembleLvbak({
    manifest: lvbakManifest({ producer: "someone-else" }),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/** schemaVersion past the only value we accept. Must reject with a versioned error. */
export function buildFutureSchemaLvbak(): Uint8Array {
  const tables = standardTables();
  return assembleLvbak({
    manifest: lvbakManifest({ schemaVersion: 2 }),
    tables,
    files: standardFiles(),
    stats: lvbakStats(tables),
  });
}

/**
 * Encrypted secrets plus a vector store. Both are skipped: the AES key lives only in the user's
 * separate ticket, and nothing in Hoplight consumes Float32 vectors.
 */
export function buildSecretsAndVectorsLvbak(): Uint8Array {
  const tables = standardTables();
  return assembleLvbak({
    manifest: lvbakManifest({ hasEncryptedSecrets: true, includeVectors: true }),
    tables,
    files: standardFiles(),
    extras: [
      textEntry("secrets/connections.enc", '{"alg":"AES-256-GCM","ciphertext":"c3ludGhldGlj"}'),
      textEntry("lancedb/characters.lance/_versions/1.manifest", '{"version":1}'),
      textEntry(
        "lancedb/characters.lance/data/part-0.lance",
        '{"note":"synthetic stand-in for raw Float32 vector bytes"}',
      ),
    ],
    stats: lvbakStats(tables),
  });
}
