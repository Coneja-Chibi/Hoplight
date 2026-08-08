/**
 * Telling a second click from a new one.
 *
 * opentui reports raw `down` and `up` and nothing else - no click count - so this is Kit's own. It is
 * pure and takes the time as an argument, because a clock read inside would make the one thing worth
 * testing here untestable: the boundary between "they double-clicked" and "they clicked twice".
 *
 * THE ROW HAS TO MATCH. Two fast clicks on two different blocks are two selections, not an open - and
 * on a list of twenty-three rows in a narrow rail, clicking two neighbours quickly is ordinary.
 */

/** The last click, or nothing yet. */
export interface ClickMemory {
  readonly id: string | null;
  readonly at: number;
}

/**
 * How close two clicks have to be.
 *
 * 400ms is the middle of the range desktop toolkits use. Too short and a deliberate double-click on
 * a slow hand is two selections; too long and two separate clicks on the same row open an editor
 * nobody asked for - which is the worse mistake, because it takes over the screen.
 */
export const DOUBLE_CLICK_MS = 400;

export const noClicks = (): ClickMemory => ({ id: null, at: 0 });

export interface ClickResult {
  /** What to remember for next time. */
  readonly memory: ClickMemory;
  /** True when this completes a double click. */
  readonly double: boolean;
}

/**
 * Record a click and say whether it was the second of a pair.
 *
 * A DOUBLE RESETS THE MEMORY. Without that, three fast clicks would read as two doubles and open the
 * editor twice - and a fourth would be a third. Pairs, not a running streak.
 */
export function registerClick(memory: ClickMemory, id: string, now: number): ClickResult {
  const isDouble = memory.id === id && now - memory.at <= DOUBLE_CLICK_MS && now >= memory.at;
  if (isDouble) return { memory: noClicks(), double: true };
  return { memory: { id, at: now }, double: false };
}
