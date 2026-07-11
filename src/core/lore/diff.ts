/**
 * Pure lorebook differ: session baseline vs current body.
 * Match pass 1 by title, pass 2 by trimmed content > 20 chars (rename catch); consume-once.
 * Word-level LCS highlights on content-like string fields only.
 */
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";

export interface FieldChange {
  field: keyof LorebookEntry;
  from: unknown;
  to: unknown;
  fromText: string;
  toText: string;
  /** Word-level highlight ranges [start, end) into fromText / toText. */
  words?: { fromRanges: [number, number][]; toRanges: [number, number][] };
}

export interface BookDiff {
  edited: {
    entryId: string;
    wasTitle?: string;
    matchedBy: "title" | "content" | "id";
    changes: FieldChange[];
  }[];
  /** Pure sortOrder swaps, paired. */
  reordered: { aId: string; bId: string }[];
  added: string[];
  /** Removed carries full entries for Bring back. */
  removed: LorebookEntry[];
}

const CONTENT_FIELDS = new Set<keyof LorebookEntry>(["content", "title", "comment"]);

const SCALAR_COMPARE_FIELDS: (keyof LorebookEntry)[] = [
  "title",
  "content",
  "comment",
  "enabled",
  "constant",
  "triggerMode",
  "selectiveLogic",
  "caseSensitive",
  "matchWholeWords",
  "scanDepth",
  "position",
  "depth",
  "role",
  "sortOrder",
  "priority",
  "sticky",
  "cooldown",
  "delay",
  "groupName",
  "categoryId",
  "groupWeight",
  "probability",
  "useMemo",
  "excludeRecursion",
  "preventRecursion",
  "delayUntilRecursion",
  "ignoreBudget",
  "vectorized",
  "groupOverride",
  "useGroupScoring",
  "automationId",
  "displayIndex",
  "keyRelative",
  "nonStoryActivatable",
];

const display = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const deepEq = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/** Tokenize on whitespace; return tokens with [start,end) ranges into the original string. */
function tokenize(text: string): { token: string; start: number; end: number }[] {
  const out: { token: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ token: m[0]!, start: m.index, end: m.index + m[0]!.length });
  }
  return out;
}

/**
 * Simple LCS on whitespace tokens; ranges that are not in the LCS are "changed".
 * fromRanges = tokens in `from` not in LCS; toRanges = tokens in `to` not in LCS.
 */
export function wordDiffRanges(
  fromText: string,
  toText: string,
): { fromRanges: [number, number][]; toRanges: [number, number][] } {
  const a = tokenize(fromText);
  const b = tokenize(toText);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i]!.token === b[j]!.token) dp[i]![j] = (dp[i + 1]![j + 1] ?? 0) + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
    }
  }
  const keepA = new Set<number>();
  const keepB = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]!.token === b[j]!.token) {
      keepA.add(i);
      keepB.add(j);
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  const fromRanges: [number, number][] = [];
  const toRanges: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    if (!keepA.has(k)) fromRanges.push([a[k]!.start, a[k]!.end]);
  }
  for (let k = 0; k < m; k++) {
    if (!keepB.has(k)) toRanges.push([b[k]!.start, b[k]!.end]);
  }
  return { fromRanges, toRanges };
}

function fieldChanges(base: LorebookEntry, cur: LorebookEntry): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of SCALAR_COMPARE_FIELDS) {
    const from = base[field];
    const to = cur[field];
    if (deepEq(from, to)) continue;
    const fromText = display(from);
    const toText = display(to);
    const change: FieldChange = { field, from, to, fromText, toText };
    if (CONTENT_FIELDS.has(field) && (fromText.length > 0 || toText.length > 0)) {
      change.words = wordDiffRanges(fromText, toText);
    }
    changes.push(change);
  }

  // Triggers arrays
  for (const field of ["triggers", "secondaryTriggers"] as const) {
    if (!deepEq(base[field], cur[field])) {
      changes.push({
        field,
        from: base[field],
        to: cur[field],
        fromText: display(base[field]),
        toText: display(cur[field]),
      });
    }
  }

  if (!deepEq(base.characterFilter, cur.characterFilter)) {
    changes.push({
      field: "characterFilter",
      from: base.characterFilter,
      to: cur.characterFilter,
      fromText: display(base.characterFilter),
      toText: display(cur.characterFilter),
    });
  }

  if (!deepEq(base.sideEffects, cur.sideEffects)) {
    changes.push({
      field: "sideEffects",
      from: base.sideEffects,
      to: cur.sideEffects,
      fromText: display(base.sideEffects),
      toText: display(cur.sideEffects),
    });
  }

  if (!deepEq(base.contextConfig, cur.contextConfig)) {
    changes.push({
      field: "contextConfig",
      from: base.contextConfig,
      to: cur.contextConfig,
      fromText: display(base.contextConfig),
      toText: display(cur.contextConfig),
    });
  }

  return changes;
}

export function diffBooks(base: LorebookBody, current: LorebookBody): BookDiff {
  const baseEntries = Array.isArray(base.entries) ? base.entries : [];
  const curEntries = Array.isArray(current.entries) ? current.entries : [];

  const baseById = new Map(baseEntries.map((e) => [e.id, e]));
  const curById = new Map(curEntries.map((e) => [e.id, e]));

  const usedBase = new Set<string>();
  const usedCur = new Set<string>();
  const pairs: { base: LorebookEntry; cur: LorebookEntry; matchedBy: "title" | "content" | "id" }[] =
    [];

  // Pass 0: same id
  for (const cur of curEntries) {
    const b = baseById.get(cur.id);
    if (b) {
      pairs.push({ base: b, cur, matchedBy: "id" });
      usedBase.add(b.id);
      usedCur.add(cur.id);
    }
  }

  // Pass 1: title (consume-once)
  const baseByTitle = new Map<string, LorebookEntry[]>();
  for (const e of baseEntries) {
    if (usedBase.has(e.id)) continue;
    const t = e.title.trim();
    if (!t) continue;
    const list = baseByTitle.get(t) ?? [];
    list.push(e);
    baseByTitle.set(t, list);
  }
  for (const cur of curEntries) {
    if (usedCur.has(cur.id)) continue;
    const t = cur.title.trim();
    if (!t) continue;
    const list = baseByTitle.get(t);
    const b = list?.shift();
    if (b && !usedBase.has(b.id)) {
      pairs.push({ base: b, cur, matchedBy: "title" });
      usedBase.add(b.id);
      usedCur.add(cur.id);
    }
  }

  // Pass 2: trimmed content > 20 chars (rename catch)
  const baseByContent = new Map<string, LorebookEntry[]>();
  for (const e of baseEntries) {
    if (usedBase.has(e.id)) continue;
    const c = e.content.trim();
    if (c.length <= 20) continue;
    const list = baseByContent.get(c) ?? [];
    list.push(e);
    baseByContent.set(c, list);
  }
  for (const cur of curEntries) {
    if (usedCur.has(cur.id)) continue;
    const c = cur.content.trim();
    if (c.length <= 20) continue;
    const list = baseByContent.get(c);
    const b = list?.shift();
    if (b && !usedBase.has(b.id)) {
      pairs.push({ base: b, cur, matchedBy: "content" });
      usedBase.add(b.id);
      usedCur.add(cur.id);
    }
  }

  const edited: BookDiff["edited"] = [];
  for (const { base: b, cur, matchedBy } of pairs) {
    const changes = fieldChanges(b, cur);
    if (changes.length === 0) continue;
    edited.push({
      entryId: cur.id,
      wasTitle: b.title !== cur.title ? b.title : undefined,
      matchedBy,
      changes,
    });
  }

  // Pure-swap detection: exactly two edited entries whose only change is sortOrder and values cross
  const reordered: BookDiff["reordered"] = [];
  const sortOnly = edited.filter(
    (e) => e.changes.length === 1 && e.changes[0]?.field === "sortOrder",
  );
  const consumed = new Set<string>();
  for (let i = 0; i < sortOnly.length; i++) {
    const a = sortOnly[i]!;
    if (consumed.has(a.entryId)) continue;
    for (let j = i + 1; j < sortOnly.length; j++) {
      const b = sortOnly[j]!;
      if (consumed.has(b.entryId)) continue;
      const aFrom = a.changes[0]!.from;
      const aTo = a.changes[0]!.to;
      const bFrom = b.changes[0]!.from;
      const bTo = b.changes[0]!.to;
      if (deepEq(aFrom, bTo) && deepEq(bFrom, aTo)) {
        reordered.push({ aId: a.entryId, bId: b.entryId });
        consumed.add(a.entryId);
        consumed.add(b.entryId);
        break;
      }
    }
  }
  // Remove pure-swap pairs from edited
  const editedOut = edited.filter((e) => !consumed.has(e.entryId));

  const matchedCur = new Set(pairs.map((p) => p.cur.id));
  const matchedBase = new Set(pairs.map((p) => p.base.id));
  const added = curEntries.filter((e) => !matchedCur.has(e.id)).map((e) => e.id);
  const removed = baseEntries.filter((e) => !matchedBase.has(e.id));

  return {
    edited: editedOut,
    reordered,
    added,
    removed,
  };
}

/** Apply a field's `from` value back onto the current body (per-field revert). */
export function revertField(
  body: LorebookBody,
  entryId: string,
  field: keyof LorebookEntry,
  value: unknown,
): LorebookBody {
  return {
    ...body,
    entries: body.entries.map((e) =>
      e.id === entryId ? { ...e, [field]: value } : e,
    ),
  };
}

/** Restore a removed entry at the end with a fresh id if id collides. */
export function restoreEntry(
  body: LorebookBody,
  entry: LorebookEntry,
  freshId: string,
): LorebookBody {
  const id = body.entries.some((e) => e.id === entry.id) ? freshId : entry.id;
  const restored: LorebookEntry = { ...structuredClone(entry), id };
  return { ...body, entries: [...body.entries, restored] };
}
