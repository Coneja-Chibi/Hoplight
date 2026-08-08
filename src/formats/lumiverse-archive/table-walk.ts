/**
 * Walking the tables: which ones to read, which to skip and report, and how one table's rows come
 * back (spec Behavior steps 3 and 7).
 *
 * Reading is a generator on purpose. A book with 22,770 entry rows has to stream, so nothing here
 * accumulates a table; callers that need one buffered say so themselves and own the memory.
 *
 * Every failure is per-row. An unparseable line, a line past the ceiling, and a row whose inner
 * JSON will not parse all produce a report entry and let the next row through. Only a container
 * bounds breach aborts, and that throws from the source rather than passing through here.
 */
import { entryNameForTable, tableNameFromEntry } from "./layout";
import type { LvbakStats } from "./manifest";
import { readNdjson } from "./ndjson";
import type { LvbakRowFailure, SkippedTable } from "./report";
import type { LvbakEntrySource } from "./source";
import {
  MAPPED_TABLES,
  isMappedTable,
  parseInnerJsonColumns,
  rowId,
  rowName,
  type InnerJsonResult,
} from "./tables";

export interface TableWalkPlan {
  /** Mapped tables the archive actually carries, in the canonical import-safe order. */
  mapped: string[];
  /** Everything else, with counts from manifest-stats or null when unknown. */
  skipped: SkippedTable[];
}

/**
 * Decide what to read before reading anything. Skipped tables are the union of two sources: table
 * dumps present in the archive that we do not map, and tables manifest-stats counted that have no
 * dump of their own (vector stores and secrets show up this way). Reporting the union is what
 * makes "your chats did not come along" a statement with a number behind it.
 */
export function planTableWalk(
  entryNames: readonly string[],
  stats: LvbakStats | null,
): TableWalkPlan {
  const present = new Set<string>();
  for (const name of entryNames) {
    const table = tableNameFromEntry(name);
    if (table !== null) present.add(table);
  }

  const mapped = MAPPED_TABLES.filter((table) => present.has(table));

  const skippedNames = new Set<string>();
  for (const table of present) if (!isMappedTable(table)) skippedNames.add(table);
  for (const table of Object.keys(stats?.counts ?? {})) {
    if (!isMappedTable(table)) skippedNames.add(table);
  }

  const skipped = [...skippedNames].sort().map(
    (table): SkippedTable => ({
      table,
      rows: stats?.counts[table] ?? null,
    }),
  );
  return { mapped: [...mapped], skipped };
}

export interface TableRow {
  /** 1-based line number inside the table dump, for pinning a failure to a place. */
  line: number;
  /** The raw dumped row, columns exactly as SQLite held them. */
  row: Record<string, unknown>;
  /** Second-parsed JSON-in-string columns, plus the ones that would not parse. */
  inner: InnerJsonResult;
}

export interface ReadTableOptions {
  /** From ndjsonLineCeiling(manifest.ndjsonFormatVersion). */
  lineCeiling: number;
  onFailure: (failure: LvbakRowFailure) => void;
}

/**
 * Stream one table's rows. A table with no dump in the archive yields nothing, which is the same
 * answer a zero-row table gives, and neither is a warning (spec edge case 10).
 */
export async function* readTable(
  source: LvbakEntrySource,
  table: string,
  options: ReadTableOptions,
): AsyncGenerator<TableRow> {
  const entry = entryNameForTable(table);
  if (!(await source.list()).includes(entry)) return;

  const rows = readNdjson(await source.open(entry), {
    maxLineBytes: options.lineCeiling,
    onFailure: ({ line, reason }) =>
      options.onFailure({ table, rowId: "", reason: `line ${line}: ${reason}` }),
  });

  for await (const { line, row } of rows) {
    yield { line, row, inner: parseInnerJsonColumns(table, row) };
  }
}

/**
 * The default row policy: any column whose inner JSON will not parse fails the row. Characters
 * override it, keeping the card from its flat columns and parking the raw string in escrow (spec
 * edge case 7), which is why this is a function a caller applies rather than a rule readTable
 * enforces.
 */
export function innerJsonRowFailure(table: string, read: TableRow): LvbakRowFailure | null {
  if (read.inner.failures.length === 0) return null;
  const reason = read.inner.failures.map((f) => `${f.column}: ${f.reason}`).join("; ");
  const failure: LvbakRowFailure = { table, rowId: rowId(read.row), reason };
  const name = rowName(read.row);
  if (name !== undefined) failure.name = name;
  return failure;
}
