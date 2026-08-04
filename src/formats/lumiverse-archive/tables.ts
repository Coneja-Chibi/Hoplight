/**
 * Which tables the importer reads, which canonical kind each produces, and the columns whose
 * values are JSON hiding inside a string (spec Behavior steps 3 and 5).
 *
 * The skip rule is by omission, not by blocklist: a table outside MAPPED_TABLES is skipped and
 * reported. That is what makes an unfamiliar future table safe. KNOWN_SKIPPED_TABLES exists to
 * document what the spec names explicitly and to fail a test if one of them ever drifts into the
 * mapped set; it is not the mechanism.
 *
 * Encrypted secrets and vector data are not tables at all, they are entry prefixes, so they live
 * in layout.ts beside the rest of the archive's shape.
 */

/** The canonical kinds one archive fans out into. */
export type LvbakKind = "character" | "lorebook" | "preset" | "persona" | "regex";

/**
 * Tables read by the importer, in import-safe order: parents before the rows that link to them
 * (lorebooks before the personas that attach them, characters before the regex sets scoped to
 * them), and feeder tables directly before their consumer (images and gallery rows feed
 * characters). planTableWalk yields this order verbatim, so the orchestrator never re-sorts.
 * Everything else in database/ is skipped and counted.
 */
export const MAPPED_TABLES = [
  "world_books",
  "world_book_entries",
  "personas",
  "images",
  "character_gallery",
  "characters",
  "presets",
  "regex_scripts",
] as const;

export type MappedTable = (typeof MAPPED_TABLES)[number];

export const isMappedTable = (table: string): table is MappedTable =>
  (MAPPED_TABLES as readonly string[]).includes(table);

/**
 * The kind a table's rows become, or null when the table only feeds another kind: images and
 * character_gallery ride inside characters, and world_book_entries join their parent book.
 */
export const TABLE_KINDS: Record<MappedTable, LvbakKind | null> = {
  characters: "character",
  images: null,
  character_gallery: null,
  world_books: "lorebook",
  world_book_entries: null,
  presets: "preset",
  personas: "persona",
  regex_scripts: "regex",
};

/**
 * Tables the spec names as never imported. Chats especially: Hoplight is not a chat frontend and
 * no canonical chat entity exists. Lumia and Council packs are skipped pending a mapping decision.
 */
export const KNOWN_SKIPPED_TABLES = [
  "chats",
  "messages",
  "settings",
  "connections",
  "extensions",
  "packs",
  "lumia_items",
  "loom_items",
  "loom_tools",
] as const;

/**
 * Columns holding doubly encoded JSON. The spec verifies extensions, prompts, prompt_order,
 * parameters, placement, target, actions, metadata, and key against a real export; the rest are
 * here because SQLite has no array or object type, so every array column is stored the same way.
 */
export const JSON_STRING_COLUMNS: Record<string, readonly string[]> = {
  characters: ["extensions", "tags", "alternate_greetings"],
  images: [],
  character_gallery: [],
  world_books: ["metadata"],
  world_book_entries: ["key", "keysecondary"],
  presets: ["prompts", "prompt_order", "parameters", "metadata"],
  personas: ["metadata"],
  regex_scripts: ["placement", "target", "actions", "trim_strings", "metadata"],
};

export interface InnerJsonFailure {
  column: string;
  reason: string;
}

export interface InnerJsonResult {
  /** Column to parsed value, for the columns that were present and parsed. */
  values: Record<string, unknown>;
  failures: InnerJsonFailure[];
}

/**
 * Second-parse every JSON-in-string column of a row. Failures are collected rather than thrown so
 * the caller picks the policy: most kinds fail the whole row, but a character whose extensions
 * will not parse still imports from its flat columns (spec edge case 7).
 *
 * A null or absent column is neither a value nor a failure, it is a column the row did not carry.
 */
export function parseInnerJsonColumns(
  table: string,
  row: Record<string, unknown>,
): InnerJsonResult {
  const result: InnerJsonResult = { values: {}, failures: [] };
  for (const column of JSON_STRING_COLUMNS[table] ?? []) {
    const raw = row[column];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      // Already decoded, which a hand-edited dump can produce. Take it as-is.
      result.values[column] = raw;
      continue;
    }
    if (raw.trim() === "") continue;
    try {
      result.values[column] = JSON.parse(raw);
    } catch (error) {
      result.failures.push({ column, reason: (error as Error).message });
    }
  }
  return result;
}

/** Lumiverse preserves primary keys verbatim, so a row without one cannot be linked or reported. */
export const rowId = (row: Record<string, unknown>): string =>
  typeof row.id === "string" ? row.id : typeof row.id === "number" ? String(row.id) : "";

export const rowName = (row: Record<string, unknown>): string | undefined =>
  typeof row.name === "string" ? row.name : undefined;
