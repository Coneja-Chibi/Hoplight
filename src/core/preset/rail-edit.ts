/**
 * Direct manipulation of a preset's block list: select, move, toggle, insert, remove.
 *
 * PURE, AND THAT IS THE POINT. Range selection, dragging a block of rows to a new place, and undo are
 * all easy to get subtly wrong and impossible to test through a terminal. Everything here is a
 * function from state to state, so the awkward cases - dragging a selection downward, dropping onto
 * a row inside the selection, shift-clicking backwards - are pinned by tests rather than by trying
 * it and squinting.
 *
 * NOTHING HERE WRITES. These produce an edited row list. The caller composes that into a draft, and
 * the draft goes through the ordinary gate and receipt like every other change. A rail that wrote
 * directly would be a second write path with no confirmation, which is exactly what the gate exists
 * to prevent; a rail that confirmed every drag would be unusable. Accumulating into one draft is how
 * both stay true.
 *
 * ORDER IS THE PAYLOAD. A preset evaluates top to bottom, so moving a row is not cosmetic - it is the
 * edit most likely to change behaviour, and the one a text diff of the file cannot show.
 */
import type { OutlineRow } from "./outline";

export interface RailState {
  readonly rows: readonly OutlineRow[];
  /** Block ids currently selected. A set, because selection is unordered. */
  readonly selected: ReadonlySet<string>;
  /** The last row clicked without shift. Shift-click extends from here, as every list does. */
  readonly anchor: string | null;
}

export const railState = (rows: readonly OutlineRow[]): RailState =>
  ({ rows, selected: new Set(), anchor: null });

/** Re-number rows after any reordering, so `index` never lies about evaluation order. */
const renumber = (rows: readonly OutlineRow[]): OutlineRow[] =>
  rows.map((row, index) => (row.index === index ? row : { ...row, index }));

const positionOf = (rows: readonly OutlineRow[], id: string): number =>
  rows.findIndex((row) => row.id === id);

/**
 * Click a row.
 *
 * Plain click replaces the selection and sets the anchor. Ctrl adds or removes one row and moves the
 * anchor to it. Shift extends from the anchor, in either direction, because a person who shift-clicks
 * upward means the same thing as one who shift-clicks downward.
 */
export function clickRow(
  state: RailState,
  id: string,
  modifiers: { shift?: boolean; ctrl?: boolean } = {},
): RailState {
  if (positionOf(state.rows, id) < 0) return state;

  if (modifiers.shift && state.anchor !== null) {
    const from = positionOf(state.rows, state.anchor);
    const to = positionOf(state.rows, id);
    if (from < 0) return { ...state, selected: new Set([id]), anchor: id };
    const [low, high] = from <= to ? [from, to] : [to, from];
    const span = state.rows.slice(low, high + 1).map((row) => row.id);
    // The anchor deliberately does not move: a second shift-click re-extends from the same origin,
    // which is what lets somebody widen and narrow a range without starting over.
    return { ...state, selected: new Set(span) };
  }

  if (modifiers.ctrl) {
    const selected = new Set(state.selected);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    return { ...state, selected, anchor: id };
  }

  return { ...state, selected: new Set([id]), anchor: id };
}

/** Select everything, or nothing. */
export const selectAll = (state: RailState): RailState =>
  ({ ...state, selected: new Set(state.rows.map((row) => row.id)) });
export const selectNone = (state: RailState): RailState =>
  ({ ...state, selected: new Set(), anchor: null });

/**
 * Move the selection so it lands BEFORE the row currently at `beforeId`, or at the end when null.
 *
 * THE TARGET IS A ROW, NOT AN INDEX, and that is what makes dragging downward work. Pulling the
 * selection out first shifts every index below it, so an index captured before the removal points
 * somewhere else afterwards - the classic off-by-the-size-of-the-selection bug. Naming the row the
 * drop lands above survives the removal, because that row moves with its own identity.
 *
 * Dropping onto a row that is itself selected is a no-op rather than an error: it is what happens
 * when somebody picks up a range and puts it back, and it should cost nothing.
 */
export function moveSelection(state: RailState, beforeId: string | null): RailState {
  if (state.selected.size === 0) return state;
  if (beforeId !== null && state.selected.has(beforeId)) return state;

  const taken = state.rows.filter((row) => state.selected.has(row.id));
  const rest = state.rows.filter((row) => !state.selected.has(row.id));
  const at = beforeId === null ? rest.length : positionOf(rest, beforeId);
  if (at < 0) return state; // the target went away between pick-up and drop

  const next = [...rest.slice(0, at), ...taken, ...rest.slice(at)];
  return { ...state, rows: renumber(next) };
}

/** Turn every selected row on, off, or to the opposite of what it is now. */
export function setEnabled(state: RailState, enabled: boolean | "toggle"): RailState {
  if (state.selected.size === 0) return state;
  return {
    ...state,
    rows: state.rows.map((row) =>
      state.selected.has(row.id)
        ? { ...row, enabled: enabled === "toggle" ? !row.enabled : enabled }
        : row,
    ),
  };
}

/** Drop the selected rows. Returns an empty selection, since what was selected is gone. */
export function removeSelection(state: RailState): RailState {
  if (state.selected.size === 0) return state;
  return {
    rows: renumber(state.rows.filter((row) => !state.selected.has(row.id))),
    selected: new Set(),
    anchor: null,
  };
}

/**
 * Put a new row in, before `beforeId` or at the end.
 *
 * The new row arrives selected, because the next thing anybody does after inserting a block is
 * something to that block, and having to find and click it first is a step nobody wanted.
 */
export function insertRow(
  state: RailState,
  row: Omit<OutlineRow, "index">,
  beforeId: string | null,
): RailState {
  if (positionOf(state.rows, row.id) >= 0) return state; // ids are the identity; never two
  const at = beforeId === null ? state.rows.length : positionOf(state.rows, beforeId);
  const target = at < 0 ? state.rows.length : at;
  const placed: OutlineRow = { ...row, index: target };
  const next = [...state.rows.slice(0, target), placed, ...state.rows.slice(target)];
  return { rows: renumber(next), selected: new Set([row.id]), anchor: row.id };
}

/** Nudge the selection one place up or down, for anyone not using a mouse. */
export function nudgeSelection(state: RailState, direction: -1 | 1): RailState {
  if (state.selected.size === 0) return state;
  const positions = state.rows
    .map((row, index) => (state.selected.has(row.id) ? index : -1))
    .filter((index) => index >= 0);
  const first = positions[0]!;
  const last = positions[positions.length - 1]!;
  if (direction === -1) {
    if (first === 0) return state;
    return moveSelection(state, state.rows[first - 1]!.id);
  }
  if (last === state.rows.length - 1) return state;
  const below = state.rows[last + 1];
  // Landing before the row AFTER the one below is what puts the selection past it.
  const anchorRow = below ? state.rows[last + 2] : undefined;
  return moveSelection(state, anchorRow ? anchorRow.id : null);
}

/** Has anything actually changed since the rail opened? Drives the pending-draft badge. */
export function railIsDirty(before: readonly OutlineRow[], after: readonly OutlineRow[]): boolean {
  if (before.length !== after.length) return true;
  return after.some((row, index) => {
    const prior = before[index]!;
    return prior.id !== row.id || prior.enabled !== row.enabled;
  });
}
