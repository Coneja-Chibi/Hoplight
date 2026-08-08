/**
 * What a key means while the cursor is inside the rewrite box.
 *
 * Pure, because the risk here is not visual. Below this in the gate handler, `y` allows and `n`
 * denies - so a letter that escaped the box would answer the confirmation mid-word, and the word
 * somebody was typing would become an approval. That is not a rendering bug, it is a write nobody
 * agreed to, and it deserves to be decided somewhere it can be pressed on directly.
 */

/** Just the parts of a key event this reads. */
export interface EditKey {
  readonly name?: string | undefined;
  readonly sequence?: string | undefined;
}

export type EditAction =
  /** Leave the box; the gate's own keys work again. */
  | { readonly kind: "leave" }
  /** Accept what is in the box, edits and all. */
  | { readonly kind: "accept" }
  /** Replace the text with this. */
  | { readonly kind: "text"; readonly text: string };

/**
 * Decide, given the text currently in the box.
 *
 * EVERY KEY IS CLAIMED. There is no fall-through: a key this does not recognise returns null and the
 * caller swallows it anyway, because "the box has the keyboard" has to mean all of it. Letting the
 * unrecognised ones past is how `n` becomes a denial while somebody types the word "not".
 */
export function editAction(key: EditKey, text: string): EditAction | null {
  if (key.name === "escape") return { kind: "leave" };
  if (key.name === "return") return { kind: "accept" };
  if (key.name === "backspace") return { kind: "text", text: text.slice(0, -1) };
  const typed = key.sequence ?? "";
  // The SEQUENCE, never the name: `name` normalises a space to the word "space", which would put
  // that word into somebody's prompt.
  if (typed.length === 1 && typed >= " ") return { kind: "text", text: text + typed };
  return null;
}
