/**
 * Picking pieces off a shelf: one click, a range, a held modifier, or a box dragged over them.
 *
 * ONE RULE SET, because these three gestures are not three features - they are one selection model
 * with three ways in, and built separately they disagree. A shift-range that forgets the anchor, a
 * box that clears what the clicks chose, a ctrl-click that behaves like a plain click: each is a
 * small bug on its own and together they make a shelf you cannot trust to hold what you picked.
 *
 * PURE, so the awkward parts are checkable without a browser. What is left in the view is reading
 * modifier keys off an event and measuring rectangles, neither of which has a decision in it.
 */

/** Where a range starts. Held by the room, because it outlives any one click. */
export interface Picking {
  readonly selected: ReadonlySet<string>;
  /** The last piece touched by a plain or modified click; the far end of the next shift-range. */
  readonly anchor: string;
}

export interface PickInput {
  /** The piece clicked, by its `kind:id` key. */
  readonly key: string;
  /** Every key on the shelf RIGHT NOW, in the order they are drawn. Ranges are visual. */
  readonly order: readonly string[];
  readonly shift: boolean;
  /** ctrl on Windows and Linux, cmd on a Mac; the caller reads whichever its platform sent. */
  readonly meta: boolean;
  /** Pieces already open on the Workbench: staging one is a no-op, so it is never picked. */
  readonly open: ReadonlySet<string>;
}

/**
 * The keys between two, inclusive, in the order they are shown.
 *
 * DRAWN ORDER, NOT STORED ORDER. A person shift-clicking means "these, the ones I can see between
 * my two clicks" - so a filtered or re-ranked shelf ranges over what is on screen, not over some
 * underlying list they are not looking at.
 */
export function rangeBetween(
  order: readonly string[],
  from: string,
  to: string,
): readonly string[] {
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  // An anchor that has scrolled out of the filter is not a range; the click stands alone.
  if (a === -1 || b === -1) return [to];
  return a <= b ? order.slice(a, b + 1) : order.slice(b, a + 1);
}

/**
 * One click, with whatever was held down.
 *
 * PLAIN CLICK STILL TOGGLES, which is the behaviour this shelf has always had and the reason it
 * needs no instructions: tap to stage, tap again to unstage. Adding ranges must not quietly turn
 * that into "replace the selection", which is what a file manager does and what would make every
 * accidental click destroy a batch somebody spent a minute building.
 */
export function applyPick(current: Picking, input: PickInput): Picking {
  const { key, order, shift, meta, open } = input;

  if (shift && current.anchor) {
    /**
     * A RANGE ADDS, never replaces. Shift-clicking a second run of pieces after a first extends the
     * batch; clearing here would silently drop the earlier run at the moment somebody is plainly
     * building one big selection.
     */
    const next = new Set(current.selected);
    for (const inRange of rangeBetween(order, current.anchor, key)) {
      if (!open.has(inRange)) next.add(inRange);
    }
    // The anchor stays put, so a second shift-click re-ranges from the same origin - the behaviour
    // every list in every operating system has.
    return { selected: next, anchor: current.anchor };
  }

  // Plain and ctrl/cmd click are the same act here: toggle exactly one, keep the rest. They are
  // spelled separately anyway because a person reaching for ctrl expects it to be additive, and
  // this way that expectation is met rather than accidentally satisfied.
  const next = new Set(current.selected);
  if (next.has(key)) next.delete(key);
  else if (!open.has(key)) next.add(key);
  else return { selected: current.selected, anchor: key };
  void meta;
  return { selected: next, anchor: key };
}

/** A rectangle in page coordinates. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Two drag points into a rectangle, whichever way the drag went. */
export function boxOf(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Box {
  return {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
}

/** Did the pointer travel far enough to mean a drag rather than a click that wobbled? */
export const isDrag = (box: Box): boolean =>
  box.right - box.left > 4 || box.bottom - box.top > 4;

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Which pieces a dragged box touches.
 *
 * TOUCHING, NOT CONTAINING. A box has to fully swallow a card before it counts under the strict
 * reading, so dragging across a row of tall cards selects nothing and reads as broken. Every file
 * manager worth copying uses intersection.
 */
export function marqueeHits(
  cards: readonly { readonly key: string; readonly box: Box }[],
  box: Box,
  open: ReadonlySet<string>,
): readonly string[] {
  return cards
    .filter((card) => !open.has(card.key) && overlaps(card.box, box))
    .map((card) => card.key);
}

/**
 * The selection after a box is released.
 *
 * ADDITIVE WITH A MODIFIER, replacing without one - the opposite default from a click, and right
 * for the same reason: a box is a deliberate sweep of an area, so it says what is picked there,
 * while a held modifier says "and these too".
 */
export function applyMarquee(
  current: Picking,
  hits: readonly string[],
  additive: boolean,
): Picking {
  const next = additive ? new Set(current.selected) : new Set<string>();
  for (const key of hits) next.add(key);
  return { selected: next, anchor: hits.at(-1) ?? current.anchor };
}

/**
 * Did somebody select TEXT rather than mean to stage a piece?
 *
 * Cards are buttons, so a drag across a name both highlights the text and fires a click. Without
 * this, copying an id like `3035a5467e03eaa245de3ac318018404` stages the piece as a side effect -
 * the gesture would work and quietly do something else as well.
 */
export const selectedText = (selection: { isCollapsed: boolean; toString(): string } | null): boolean =>
  selection !== null && !selection.isCollapsed && selection.toString().trim().length > 0;
