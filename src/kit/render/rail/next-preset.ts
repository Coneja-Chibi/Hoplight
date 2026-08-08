/**
 * Which preset a step lands on.
 *
 * Pure, because the interesting cases are the ones nobody looks at: an id that is no longer in the
 * list, a shelf of one, and the wrap at either end. The version this replaces got the missing-id case
 * wrong in a way that looked exactly like a dead key.
 */

/** Just enough of a shelf entry to step through it. */
export interface Steppable {
  id: string;
}

/**
 * The next id in `delta`'s direction, or null when there is nowhere to go.
 *
 * WRAPS, because a shelf you thumb through has no dead end.
 *
 * WHEN THE CURRENT ID IS MISSING, the direction still decides. The old code pinned to index 0 in that
 * case, ignoring delta entirely - so if the rail happened to be showing the first preset, every press
 * of either arrow re-opened the one already on screen and the key read as dead. A preset can go
 * missing for ordinary reasons: it was renamed, or applied as a copy under a new id, or somebody
 * deleted it in another window.
 */
export function nextPreset(
  all: readonly Steppable[],
  currentId: string | null,
  delta: number,
): string | null {
  if (all.length === 0) return null;
  const at = currentId === null ? -1 : all.findIndex((piece) => piece.id === currentId);
  if (at < 0) {
    // Enter the shelf from whichever end the direction implies, rather than always the first.
    return (delta >= 0 ? all[0] : all[all.length - 1])!.id;
  }
  if (all.length === 1) return null;
  const next = all[(at + delta + all.length) % all.length]!;
  return next.id === currentId ? null : next.id;
}
