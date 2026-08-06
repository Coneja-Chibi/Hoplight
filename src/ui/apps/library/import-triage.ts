/**
 * Pure import-triage logic: sorting a drop before the wire, duplicate marking (shelf and
 * within-drop), default-check selection, failure grouping, and receipt annotation. No React, no
 * network; the sheet and runners live in import-flow.tsx.
 */
import type { InspectResult } from "../../app-contract";
import type { ImportedEntity, LvbakImportReport, LvbakRowFailure, SkippedTable } from "../../../formats/lumiverse-archive/report";
import type { LvbakKind } from "../../../formats/lumiverse-archive/tables";

export interface ReadFile {
  filename: string;
  result: InspectResult;
  /** Heal notes for lorebook payloads (empty when not a book or already clean). */
  healNotes?: string[];
  entryCount?: number;
  /** Name of the shelf piece this matches (same kind + name). Checkable, default unchecked. */
  shelfDupe?: string;
  /** Filename of the identical file earlier in this drop. Informational, never checkable. */
  batchDupe?: string;
  /** The source .lvbak's own filename, set only for rows an archive fanned out (never for a
   *  single-file inspect). Scopes cross-row lookups: two archives can coincidentally mint the same
   *  id, so a reference is only ever resolved against rows sharing this same key. */
  archiveKey?: string;
}

/** Extensions any adapter could possibly eat; everything else is triaged out before the wire. */
const CANDIDATE_EXTENSIONS = new Set(["json", "png", "charx", "risum"]);
const TRIAGE_MAX_BYTES = 64 * 1024 * 1024;

const extOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/**
 * Sort a drop into files worth inspecting and files we can refuse by name alone. The server's
 * detection race stays the real judge for candidates; triage only spares the wire the files
 * nothing could ever claim (an ST backup folder is mostly chat logs and settings).
 *
 * `.lvbak` is its own bucket, `archives`, never `candidates`: a Lumiverse backup fans out into many
 * entities server-side (POST /api/inspect-archive, a streamed upload), never the single-file,
 * bytes-in-memory /api/inspect this pool's 3-worker inspect race calls. It also skips
 * TRIAGE_MAX_BYTES entirely - a real backup is multi-gigabyte by design, and the honest ceiling is
 * server-side (LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes, src/formats/lumiverse-archive/bounds.ts), not
 * a client guess sized for a single card.
 */
export function triageFiles(
  files: File[],
): { candidates: File[]; archives: File[]; skipped: ReadFile[] } {
  const candidates: File[] = [];
  const archives: File[] = [];
  const skipped: ReadFile[] = [];
  for (const f of files) {
    const ext = extOf(f.name);
    if (ext === "lvbak") {
      archives.push(f);
      continue;
    }
    if (!CANDIDATE_EXTENSIONS.has(ext)) {
      const reason =
        ext === "jsonl"
          ? "a chat log, and Hoplight does not eat chats"
          : `not a file type Hoplight reads${ext ? ` (.${ext})` : ""}`;
      skipped.push({ filename: f.name, result: { ok: false, error: reason } });
      continue;
    }
    if (f.size > TRIAGE_MAX_BYTES) {
      skipped.push({ filename: f.name, result: { ok: false, error: "over the 64MB size ceiling" } });
      continue;
    }
    candidates.push(f);
  }
  return { candidates, archives, skipped };
}

/**
 * Stable content key for within-drop duplicate detection: entity + bundled related, verbatim,
 * when the row carries its entity; the server's contentHash when it is a staged archive row
 * (whose entity deliberately never reaches the client).
 */
export function contentKey(result: InspectResult): string | null {
  if (!result.ok) return null;
  if (result.entity) return JSON.stringify({ e: result.entity, r: result.related ?? null });
  return result.contentHash ?? null;
}

/** Kind + display name, case-folded; the separator cannot appear in a studio kind string. */
export const shelfKey = (kind: string, name: string): string => `${kind}::${name.trim().toLowerCase()}`;

/**
 * Mark a read against the shelf (same kind + display name) and against everything already read in
 * this drop (identical content). Mutates and returns the read; seen map gains its key.
 */
export function markDupes(
  read: ReadFile,
  shelf: Map<string, string>,
  seen: Map<string, string>,
): ReadFile {
  if (!read.result.ok) return read;
  const key = contentKey(read.result);
  if (key) {
    const first = seen.get(key);
    if (first !== undefined) {
      read.batchDupe = first;
      return read;
    }
    seen.set(key, read.filename);
  }
  const kind = read.result.kind ?? (read.result.entity as { kind?: string } | undefined)?.kind ?? "";
  const name = read.result.receipt?.name ?? "";
  if (kind && name) {
    const onShelf = shelf.get(shelfKey(kind, name));
    if (onShelf !== undefined) read.shelfDupe = onShelf;
  }
  return read;
}

/** The indexes a fresh sheet checks by default: readable, not a duplicate of anything. */
export function defaultCheckedIndexes(reads: ReadFile[]): number[] {
  return reads
    .map((r, i) => (r.result.ok && !r.batchDupe && !r.shelfDupe ? i : -1))
    .filter((i) => i >= 0);
}

export interface ErrorGroup {
  error: string;
  filenames: string[];
}

/** `indexes` only means something for a REAL reads[] a row actually lives in - groupBadRows'
 *  own case. A caller with no such array (groupReportFailures) has nothing honest to put there,
 *  so it returns the plain ErrorGroup instead: `g.indexes.map(i => state.reads[i])` on that result
 *  is a type error, not a silent bug in production. */
export interface BadGroup extends ErrorGroup {
  indexes: number[];
}

/** The shared bucketing core: group by `error`, insertion-ordered, keeping each group's own items
 *  in the order they arrived. Neither groupBadRows nor groupReportFailures duplicates this. */
function groupByError<T extends { error: string }>(items: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const bucket = groups.get(item.error) ?? [];
    bucket.push(item);
    groups.set(item.error, bucket);
  }
  return [...groups.values()];
}

/** Failed reads grouped by reason, insertion-ordered, so bulk refusals collapse to one line. */
export function groupBadRows(reads: ReadFile[]): BadGroup[] {
  const items = reads
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => !r.result.ok)
    .map(({ r, index }) => ({ error: r.result.error ?? "We could not read this one.", filename: r.filename, index }));
  return groupByError(items).map((group) => ({
    error: group[0]!.error,
    filenames: group.map((g) => g.filename),
    indexes: group.map((g) => g.index),
  }));
}

/** One `.lvbak`'s own report, paired with the archive's filename so a multi-archive drop can tell
 *  its cards apart. Rendered as a card above that archive's own rows in the sheet. */
export interface ArchiveReportEntry {
  filename: string;
  report: LvbakImportReport;
}

const KIND_WORD: Record<LvbakKind, string> = {
  character: "character card",
  lorebook: "lorebook",
  persona: "persona",
  preset: "preset",
  regex: "regex set",
};

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "3 character cards, 2 lorebooks imported." - only the kinds this archive actually carried. */
export function summarizeImportedTotals(imported: Record<LvbakKind, ImportedEntity[]>): string {
  const parts = (Object.keys(imported) as LvbakKind[])
    .filter((kind) => imported[kind].length > 0)
    .map((kind) => plural(imported[kind].length, KIND_WORD[kind]));
  return parts.length > 0 ? `${parts.join(", ")} imported.` : "";
}

/** Every table KNOWN_SKIPPED_TABLES names (tables.ts), singular so `plural()` can pluralize it
 *  correctly - the fallback below humanizes an already-plural raw name (a future, unknown table)
 *  instead, and is honest about not being able to singularize a name it has never seen. */
const TABLE_WORD: Record<string, string> = {
  chats: "chat",
  messages: "message",
  settings: "setting",
  connections: "connection",
  extensions: "extension",
  packs: "pack",
  lumia_items: "Lumia item",
  loom_items: "loom item",
  loom_tools: "loom tool",
};

/** "3 chats, 12 messages did not come along." - the honesty line: nobody should finish an import
 *  believing content Hoplight never reads actually rode along. `rows: null` (no manifest-stats
 *  count) reads as "some", never a guessed zero. A table outside TABLE_WORD (a future export adds
 *  one KNOWN_SKIPPED_TABLES has not caught up to yet) shows its humanized raw name WITHOUT a forced
 *  "s" - a SQL table name is conventionally already plural, and guessing wrong reads worse than not
 *  guessing (a known word is deliberately singular so pluralizing it IS safe). */
export function summarizeSkippedTables(skipped: SkippedTable[]): string {
  if (skipped.length === 0) return "";
  const parts = skipped.map(({ table, rows }) => {
    const known = TABLE_WORD[table];
    const count = rows === null ? "some" : rows;
    if (known) return rows === null ? `some ${known}s` : plural(rows, known);
    return `${count} ${table.replace(/_/g, " ")}`;
  });
  return `${parts.join(", ")} did not come along.`;
}

/**
 * A report's own per-row failures, grouped by reason on the SAME shared core groupBadRows uses -
 * reused, not reimplemented. Returns ErrorGroup, not BadGroup: there is no reads[] these failures
 * ever joined, so an `indexes` field would be a lie a caller could compile against and crash on.
 */
export function groupReportFailures(failures: LvbakRowFailure[]): ErrorGroup[] {
  const items = failures.map((f) => ({ error: f.reason, filename: f.name || f.rowId || f.table }));
  return groupByError(items).map((group) => ({
    error: group[0]!.error,
    filenames: group.map((g) => g.filename),
  }));
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Annotate a successful inspect with an entry count. Every ok result here comes from a real format
 * adapter (server-engine handleInspect), so the body is already canonical and MUST pass through
 * untouched: healBook is a tolerant reader for foreign payloads that rebuilds by enumeration, and
 * running it on a canonical body silently reset every field outside its list (categories,
 * positions, selective logic, filters). Heal belongs to paths that ingest naked JSON, not this one.
 */
export function annotateRead(filename: string, result: InspectResult): ReadFile {
  // A staged archive row carries no entity; its count arrives precomputed on the summary row.
  if (result.ok && !result.entity) return { filename, result, entryCount: result.entryCount };
  if (!result.ok || !result.entity) return { filename, result };
  const entity = result.entity as { kind?: string; body?: unknown };
  const countOf = (v: unknown): number | undefined =>
    isRec(v) && Array.isArray(v.entries) ? v.entries.length : undefined;
  if (entity.kind !== "lorebook") {
    // related lorebooks on a character bundle
    const related = result.related?.lorebooks;
    if (Array.isArray(related) && related.length > 0) {
      const entries = related.reduce<number>(
        (n, lb) => n + (countOf(isRec(lb) ? lb.body : undefined) ?? 0),
        0,
      );
      return { filename, result, entryCount: entries || undefined };
    }
    return { filename, result };
  }
  return { filename, result, entryCount: countOf(entity.body) };
}

/** A row's lorebook references: the summary row's own list when staged, dug out of the entity
 *  otherwise. One reader for both shapes so the caveat helpers can never disagree. */
function rowKnowledgeRefs(result: InspectResult): string[] {
  if (!result.ok) return [];
  if (result.knowledgeRefs) return result.knowledgeRefs;
  const body = (result.entity as { body?: { knowledgeRefs?: unknown } } | undefined)?.body;
  const refs = Array.isArray(body?.knowledgeRefs) ? body.knowledgeRefs : [];
  return refs.filter((r): r is string => typeof r === "string");
}

/**
 * The archive-minted ids one archive's CHECKED dependents (character/persona rows) reference that
 * will NOT resolve if the sheet commits right now: the target lorebook row is missing from this
 * drop, failed to import, or is simply unchecked (ISC-35's commit path, deck-core.ts's
 * orderForCommit + rewriteKnowledgeRefsFor, only fixes up a target that is both PRESENT and
 * CHECKED). Scoped to one archive (`archiveKey`) - two different uploads can coincidentally mint
 * the same id, and a cross-archive match here would be a false "this is fine."
 *
 * A reference only counts at all when the REFERENCING row is itself checked: an unchecked
 * character/persona is not being committed, so its own link "not carrying over" is not a fact
 * about this commit - only a checked row's own unresolved links are real ones (M14's own fix: the
 * earlier version harvested refs from every row regardless of selection, so "nothing checked" still
 * decorated an unchecked row with a caveat about a commit that was never going to touch it).
 *
 * Recomputed from the sheet's own live `checked` state on every render, not baked in once at
 * inspect time: whether a reference resolves is a property of what is CURRENTLY checked, and that
 * changes every time the user toggles a row.
 */
export function unresolvedArchiveRefs(
  reads: readonly ReadFile[],
  checked: ReadonlySet<number>,
  archiveKey: string,
): Set<string> {
  const resolvable = new Set<string>();
  const referenced = new Set<string>();
  reads.forEach((r, i) => {
    if (r.archiveKey !== archiveKey || !r.result.ok) return;
    // Staged summary rows carry entityId + knowledgeRefs at the top level; only pre-staging rows
    // (and tests') carry an entity to dig them out of. Read whichever is present.
    const entity = r.result.entity as { id?: unknown; body?: { knowledgeRefs?: unknown } } | undefined;
    const rowId = r.result.entityId ?? (typeof entity?.id === "string" ? entity.id : undefined);
    if (r.result.kind === "lorebook" && typeof rowId === "string" && checked.has(i)) {
      resolvable.add(rowId);
    }
    if ((r.result.kind === "character" || r.result.kind === "persona") && checked.has(i)) {
      for (const ref of rowKnowledgeRefs(r.result)) referenced.add(ref);
    }
  });
  const unresolved = new Set<string>();
  for (const ref of referenced) if (!resolvable.has(ref)) unresolved.add(ref);
  return unresolved;
}

/**
 * An archive row's own caveat, added to a RENDERED copy of its receipt - never mutating the
 * server's own result, and never baked in once at inspect time. Narrowed from an earlier pass that
 * warned on every linked row unconditionally: now that the commit path actually resolves a
 * checked, successfully-imported target correctly, warning about that case too would train users
 * to ignore a caveat that is usually wrong. Fires only when `unresolvedRefs` (this row's own
 * archive's currently-unresolvable ids) actually contains one of this row's own references.
 */
export function withArchiveLinkCaveat(result: InspectResult, unresolvedRefs: ReadonlySet<string>): InspectResult {
  if (!result.ok || !result.receipt) return result;
  if (result.kind !== "character" && result.kind !== "persona") return result;
  const hasUnresolved = rowKnowledgeRefs(result).some((r) => unresolvedRefs.has(r));
  if (!hasUnresolved) return result;
  return {
    ...result,
    receipt: {
      ...result.receipt,
      extras: [
        ...result.receipt.extras,
        "Links to a lorebook from the same backup, but that book is not checked (or did not import) - check it too, or this link will not carry over.",
      ],
    },
  };
}
