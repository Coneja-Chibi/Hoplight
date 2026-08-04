/**
 * Who gets the key.
 *
 * THE FAILURE THIS OWNS. opentui stops dispatching a key to the focused renderable once a global
 * `useKeyboard` listener calls `preventDefault()` on it. Kit hit that once already: an open rail with
 * no focus guard swallowed the composer's input, and the fix - `if (!focused) return;` BEFORE any
 * preventDefault - was applied to that one component. Applied once, it is a patch. Applied by every
 * component from memory, it is a bug waiting for the next surface, because "did I remember the guard"
 * is not a property anything can check.
 *
 * So focus becomes a STACK with one owner at a time, and the rule is stated once here rather than
 * repeated per component: the layer on top claims the intent, and everything below it sees nothing.
 * That is also what a person means by focus - typing goes to the thing that is open, and Escape gives
 * it back to what was underneath.
 *
 * Pure and total. No React, no opentui, no state outside the value passed in - so the ordering rules
 * can be tested without a terminal, which is the part that was never testable before.
 */

/** The layers that can hold focus, listed OUTERMOST first purely for reading order. */
export type Layer =
  | "composer"
  | "rail"
  | "menu"
  | "search"
  | "gate"
  | "screen";

/**
 * Layers that take focus the moment they open, ordered by how urgently they need it.
 *
 * The Gate outranks everything, and that is a safety property rather than a preference: it is asking
 * whether to let something happen, so a keystroke meant for it must never land in the composer and
 * leave the question hanging behind a screen the person then types into.
 */
const PRIORITY: Record<Layer, number> = {
  gate: 100,
  menu: 80,
  search: 70,
  screen: 60,
  rail: 40,
  composer: 0,
};

export interface FocusState {
  /** Open layers, in the order they were pushed. The composer is always the floor. */
  readonly stack: readonly Layer[];
}

export const EMPTY_FOCUS: FocusState = { stack: ["composer"] };

/** Open a layer and give it focus. Pushing a layer that is already open is a no-op, not a duplicate. */
export function push(state: FocusState, layer: Layer): FocusState {
  if (state.stack.includes(layer)) return state;
  return { stack: [...state.stack, layer] };
}

/** Close a layer. The composer is the floor and cannot be popped, or nothing would own the keyboard. */
export function pop(state: FocusState, layer: Layer): FocusState {
  if (layer === "composer") return state;
  if (!state.stack.includes(layer)) return state;
  return { stack: state.stack.filter((l) => l !== layer) };
}

/**
 * The layer that owns the keyboard right now: the highest-priority OPEN layer.
 *
 * Priority rather than push order, because open order is an accident of how somebody got here - a
 * gate that opens while the rail is up must still take the keys, and it would not if the newest push
 * simply won.
 */
export function owner(state: FocusState): Layer {
  let best: Layer = "composer";
  for (const layer of state.stack) {
    if (PRIORITY[layer] > PRIORITY[best]) best = layer;
  }
  return best;
}

/**
 * Whether this layer may act on a key right now.
 *
 * The ONE call every component makes before touching an event. A component that asks this and gets
 * false must not read the key and must not preventDefault it - swallowing a key it is not going to
 * use is exactly how the rail deafened the composer.
 */
export const hasFocus = (state: FocusState, layer: Layer): boolean => owner(state) === layer;

/** Is this layer open at all (visible), regardless of who holds the keyboard? */
export const isOpen = (state: FocusState, layer: Layer): boolean => state.stack.includes(layer);

/**
 * What Escape should close: the current owner, unless that is the composer.
 *
 * Escape at the floor is not "close the composer" - there is nothing under it - so it stays a turn
 * cancel, which is why this returns null rather than a layer there.
 */
export const escapeTarget = (state: FocusState): Layer | null => {
  const top = owner(state);
  return top === "composer" ? null : top;
};
