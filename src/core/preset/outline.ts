/**
 * A preset as a list you can watch: every block, in evaluation order, with what changed since last
 * time.
 *
 * WHY ORDER IS THE WHOLE POINT. A preset's blocks are evaluated top to bottom, so a block can be
 * enabled, expand perfectly, and still never be read because something later overwrote what it wrote.
 * That failure is invisible in a diff of content, because no content changed. It is only visible as
 * position. So the diff below reports MOVES first-class, and reports them as a distance rather than
 * as a remove-plus-add, which is what a text differ would say and what a reader cannot act on.
 *
 * SECTIONS ARE NOT COMPUTED. Real presets carry no folders - the surveyed ones have zero - and write
 * their section headings as ordinary blocks whose name is the heading. There is nothing to derive:
 * the names already are the structure, and a reader's eye groups them the moment they are in order.
 * An earlier attempt to label those blocks is exactly the guessing the classifier now refuses.
 *
 * PURE. No bridge, no filesystem, no rendering. A caller hands it two bodies.
 */
import type { PresetBody, PresetPrompt } from "../../entities/preset";

export interface OutlineRow {
  /** Position in evaluation order. This is the fact the whole surface exists to show. */
  readonly index: number;
  readonly id: string;
  /** What the author called it; falls back to the id, which is never empty. */
  readonly name: string;
  readonly enabled: boolean;
  /** A reserved engine slot: the host splices its own content in here. */
  readonly marker: boolean;
  /** Characters of authored content. Zero is meaningful: the block emits only its own name. */
  readonly size: number;
  /**
   * A new name for this block, when somebody has typed one and not yet applied it.
   *
   * Held on the ROW rather than written into the preset, because the rail never writes: edits
   * accumulate and Enter stages the lot as one ordinary draft at the same Gate a model draft meets.
   */
  readonly editedName?: string;
  /** New content for this block, same rule as editedName: staged, never written in place. */
  readonly editedContent?: string;
  readonly role: string;
}

export type OutlineChangeKind = "moved" | "added" | "removed" | "enabled" | "disabled" | "edited";

export interface OutlineChange {
  readonly kind: OutlineChangeKind;
  readonly id: string;
  readonly name: string;
  /** Where it sits now; null for a removal, which is nowhere. */
  readonly index: number | null;
  /** Where it sat before; null for an addition. Present on a move so the jump is readable. */
  readonly from?: number;
}

export interface OutlineDiff {
  readonly changes: readonly OutlineChange[];
  readonly after: readonly OutlineRow[];
}

const nameOf = (prompt: PresetPrompt): string => {
  const name = (prompt.name ?? "").replace(/\s+/g, " ").trim();
  return name || prompt.id;
};

/** Read a preset body as an ordered list of rows. */
export function outlineOf(body: PresetBody | undefined): OutlineRow[] {
  // DUPLICATE IDS ARE MADE UNIQUE HERE, at the only door into every id-keyed structure downstream.
  // Not every importer dedupes - the SillyTavern reader does, the Marinara one does not - so two
  // blocks really can share an identifier. Everything past this point keys on the id: a Map, which
  // silently keeps the last of each, and a Set for selection, which cannot tell two rows apart.
  // Two measured consequences: deleting one of a colliding pair deleted BOTH and reported one, and
  // removing the second reported a move of the first that never happened.
  //
  // The suffix rides the ROW only and never reaches storage. applyRailEdits looks prompts up by row
  // id, so a suffixed row finds nothing and lands in `unknown`, which refuses the whole write rather
  // than applying half of it. That is the safe direction: a preset with colliding ids can be looked
  // at and cannot be silently rewritten.
  const seen = new Map<string, number>();
  return (body?.prompts ?? []).map((prompt, index) => {
    const count = seen.get(prompt.id) ?? 0;
    seen.set(prompt.id, count + 1);
    return {
      index,
      id: count === 0 ? prompt.id : `${prompt.id}#${count}`,
      name: nameOf(prompt),
      enabled: prompt.enabled !== false,
      marker: prompt.marker === true,
      size: (prompt.content ?? "").length,
      role: prompt.role ?? "system",
    };
  });
}

/**
 * The positions that can stay put, as a set of indexes into `order`.
 *
 * A longest increasing subsequence. Everything in it is already in relative order and needs no
 * explanation; everything outside it is what actually travelled. Patience sorting, so a 150-block
 * preset costs nothing.
 */
function stayingPut(order: readonly number[]): Set<number> {
  const tails: number[] = []; // tails[k] = index into order of the smallest tail of a length-(k+1) run
  const came: number[] = new Array<number>(order.length).fill(-1);
  for (let i = 0; i < order.length; i += 1) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (order[tails[mid]!]! < order[i]!) low = mid + 1;
      else high = mid;
    }
    if (low > 0) came[i] = tails[low - 1]!;
    tails[low] = i;
  }
  const keep = new Set<number>();
  let at = tails.length > 0 ? tails[tails.length - 1]! : -1;
  while (at >= 0) {
    keep.add(at);
    at = came[at]!;
  }
  return keep;
}

/**
 * What changed between two readings.
 *
 * A MOVE IS REPORTED ONLY WHEN IT IS REALLY A MOVE, and getting that right needs more than comparing
 * indexes. Two failures make the point. Inserting one block at the top shifts all 150 indexes by one,
 * so index comparison calls that 150 moves. Ranking only the survivors fixes that and still fails the
 * real case: dragging one block from position 3 to position 1 shifts the two it passed, so three
 * blocks report as moved when one was dragged.
 *
 * So the survivors are read in their new order and the longest run already in relative order is
 * treated as having stayed. Whatever is left is what a person actually moved, which for that drag is
 * exactly one block. A rail that lights up three rows for one drag has hidden the change inside the
 * noise it made.
 */
export function diffOutline(
  before: readonly OutlineRow[],
  after: readonly OutlineRow[],
): OutlineDiff | null {
  const old = new Map(before.map((row) => [row.id, row]));
  const next = new Map(after.map((row) => [row.id, row]));
  const changes: OutlineChange[] = [];

  for (const row of after) {
    if (!old.has(row.id)) changes.push({ kind: "added", id: row.id, name: row.name, index: row.index });
  }
  for (const row of before) {
    if (!next.has(row.id)) changes.push({ kind: "removed", id: row.id, name: row.name, index: null });
  }

  // Survivors, in their new order, carrying where they used to rank. The longest already-ordered run
  // through that stayed put; everything else is what somebody moved.
  const rankBefore = new Map(
    before.filter((row) => next.has(row.id)).map((row, rank) => [row.id, rank] as const),
  );
  const survivors = after.filter((row) => old.has(row.id));
  const settled = stayingPut(survivors.map((row) => rankBefore.get(row.id)!));
  const movedIds = new Set(
    survivors.filter((_, position) => !settled.has(position)).map((row) => row.id),
  );

  for (const row of after) {
    const prior = old.get(row.id);
    if (!prior) continue;
    if (movedIds.has(row.id)) {
      changes.push({ kind: "moved", id: row.id, name: row.name, index: row.index, from: prior.index });
      continue; // a move is the headline; an edit in the same beat is the smaller news
    }
    if (prior.enabled !== row.enabled) {
      changes.push({
        kind: row.enabled ? "enabled" : "disabled",
        id: row.id,
        name: row.name,
        index: row.index,
      });
      continue;
    }
    if (prior.size !== row.size || prior.name !== row.name) {
      changes.push({ kind: "edited", id: row.id, name: row.name, index: row.index });
    }
  }

  if (changes.length === 0) return null;
  return { changes, after: [...after] };
}

/** How many blocks are actually on. The count people mean when they ask how big a preset is. */
export const enabledCount = (rows: readonly OutlineRow[]): number =>
  rows.filter((row) => row.enabled).length;

/** One line for the transcript, so a change is legible even with the rail closed. */
export function outlineSummary(diff: OutlineDiff): string {
  const moved = diff.changes.filter((change) => change.kind === "moved");
  if (moved.length === 1 && diff.changes.length === 1) {
    const one = moved[0]!;
    return `moved ${one.name} · ${one.from} to ${one.index}`;
  }
  const tally = new Map<OutlineChangeKind, number>();
  for (const change of diff.changes) tally.set(change.kind, (tally.get(change.kind) ?? 0) + 1);
  const parts = [...tally].map(([kind, count]) => `${count} ${kind}`);
  return parts.join(" · ");
}
