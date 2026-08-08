/**
 * Which keys thumb through the shelf, as a pure decision.
 *
 * Pulled out because this binding has been reported broken twice and I twice concluded from reading
 * the handler that it was fine. Reading is not evidence. The decision is four cases and it can be
 * checked without a terminal, so it should be.
 *
 * TWO SPELLINGS, ON PURPOSE. `<` and `>` are what was asked for first, and the arrow keys are what
 * hands reach for. They mean the same thing and both are bound.
 */

/** The subset of a key event this decision needs. */
export interface StepKey {
  name?: string;
  sequence?: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  option?: boolean;
}

/**
 * +1 for the next preset, -1 for the previous, null when this key means something else.
 *
 * A MODIFIER DISQUALIFIES IT. Ctrl+Shift+Left already resizes the rail, and alt+arrow moves a block,
 * so an arrow only steps when it arrives bare. Without that check the resize chord would also flip
 * the preset out from under the person resizing it.
 */
export function stepDelta(event: StepKey): 1 | -1 | null {
  if (event.ctrl === true || event.meta === true || event.option === true) return null;

  // The angle brackets are matched on the SEQUENCE: their key name arrives as "," and "." with shift
  // held, and binding those would fire on an unshifted comma somebody typed.
  if (event.sequence === ">") return 1;
  if (event.sequence === "<") return -1;

  const name = (event.name ?? "").toLowerCase();
  if (name === "right") return 1;
  if (name === "left") return -1;
  return null;
}
