/**
 * Pure import-triage logic: sorting a drop before the wire, duplicate marking (shelf and
 * within-drop), default-check selection, failure grouping, and receipt annotation. No React, no
 * network; the sheet and runners live in import-flow.tsx.
 */
import type { InspectResult } from "../../app-contract";

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

/** Stable content key for within-drop duplicate detection (entity + bundled related, verbatim). */
export function contentKey(result: InspectResult): string | null {
  if (!result.ok || !result.entity) return null;
  return JSON.stringify({ e: result.entity, r: result.related ?? null });
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
  if (!read.result.ok || !read.result.entity) return read;
  const key = contentKey(read.result);
  if (key) {
    const first = seen.get(key);
    if (first !== undefined) {
      read.batchDupe = first;
      return read;
    }
    seen.set(key, read.filename);
  }
  const kind = read.result.kind ?? (read.result.entity as { kind?: string }).kind ?? "";
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

export interface BadGroup {
  error: string;
  filenames: string[];
  indexes: number[];
}

/** Failed reads grouped by reason, insertion-ordered, so bulk refusals collapse to one line. */
export function groupBadRows(reads: ReadFile[]): BadGroup[] {
  const groups = new Map<string, BadGroup>();
  reads.forEach((r, i) => {
    if (r.result.ok) return;
    const error = r.result.error ?? "We could not read this one.";
    const g = groups.get(error) ?? { error, filenames: [], indexes: [] };
    g.filenames.push(r.filename);
    g.indexes.push(i);
    groups.set(error, g);
  });
  return [...groups.values()];
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
