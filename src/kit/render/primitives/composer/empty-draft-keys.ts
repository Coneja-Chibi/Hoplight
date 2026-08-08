/**
 * What a key means when the draft is empty, and only then.
 *
 * THE EMPTY GUARD IS THE WHOLE DESIGN. A "1" typed into a half-written sentence is a digit; an arrow
 * pressed in one is a cursor move. Nothing may take those, and the keystroke alone cannot tell you
 * which case you are in - only what is already in the buffer can. An empty draft has no sentence to
 * be part of and no cursor to move, which is exactly when a key can safely mean something else.
 *
 * Pure and separate because it is the seam that lets the rail be driven WITHOUT a modal focus.
 * Handing the rail the keyboard so it could hear an arrow meant every letter went to it too, where
 * "n" opens a note and "r" a rename - so somebody who opened the rail and then tried to type a
 * message found the terminal eating it. The keyboard stays in the composer, where typing works, and
 * only the keys with nothing else to do reach across.
 */

/** Just the parts of a key event this decision reads. */
export interface DraftKey {
  readonly name?: string | undefined;
  readonly ctrl?: boolean | undefined;
  readonly shift?: boolean | undefined;
  readonly meta?: boolean | undefined;
  readonly option?: boolean | undefined;
}

/** What is on screen that would otherwise claim these keys. */
export interface DraftContext {
  /** The draft as typed. Anything non-empty disqualifies every rule here. */
  readonly draft: string;
  /** A popup is open and owns its own navigation. */
  readonly menuOpen: boolean;
  /** Is a rail open to be stepped through? */
  readonly railOpen: boolean;
}

/**
 * Thumb the rail one preset in this direction.
 *
 * A NUMBER KEY USED TO LIVE HERE TOO, filling the draft with an offered option. The question
 * panel owns its own numbers now - it has a cursor, a note and a write-your-own field, none of
 * which this could know about - so a second copy of that rule here could only drift from it.
 */
export type EmptyDraftAction = { readonly kind: "step-rail"; readonly delta: number };

/** Any modifier means the key was aimed somewhere else, so none of these rules apply. */
const bare = (key: DraftKey): boolean =>
  key.ctrl !== true && key.shift !== true && key.meta !== true && key.option !== true;

/** What this key should do, or null to let the textarea have it. */
export function emptyDraftAction(key: DraftKey, context: DraftContext): EmptyDraftAction | null {
  if (context.draft !== "" || context.menuOpen) return null;

  if (context.railOpen && bare(key) && (key.name === "left" || key.name === "right")) {
    return { kind: "step-rail", delta: key.name === "left" ? -1 : 1 };
  }

  return null;
}
