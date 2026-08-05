/**
 * When does a keystroke or a paste mean "put a picture in"?
 *
 * Pure, and separate from the composer, because the answer is four rules that were each found the
 * hard way and are worth reading in one place rather than inside a key handler.
 *
 * ALT ARRIVES UNDER TWO NAMES. The Kitty keyboard protocol reports alt as `option`; the older
 * ESC-prefix convention, which every terminal has sent for decades, arrives as ESC then the key and
 * opentui reports it as `meta`. Reading only `option` is what made alt+V look undeliverable, and led
 * to a confident wrong diagnosis that the terminal was at fault. Both are read now.
 *
 * CTRL+V IS THE TERMINAL'S KEY, NOT KIT'S. The terminal reads the clipboard itself and sends the
 * TEXT. When the clipboard holds a picture there is no text, so what arrives is a paste of nothing:
 * an empty paste is a pasted image, and asking the OS is the only way to find out what it was. If the
 * terminal instead passes ctrl+v through as a key, we never saw a paste, so handling the key too
 * cannot double-fire.
 */

/** The subset of a key event this decision needs. */
export interface ImageKey {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  option?: boolean;
}

/**
 * Does this key mean "paste an image"?
 *
 * alt+V is the advertised one. ctrl+G is the alternative that needs no alt at all. ctrl+V only
 * reaches here on a terminal that did not claim it for itself, which is exactly the case where
 * nothing else would happen.
 */
export function isImagePasteKey(event: ImageKey): boolean {
  const alt = event.option === true || event.meta === true;
  if (alt && event.name === "v") return true;
  return event.ctrl === true && (event.name === "g" || event.name === "v");
}

/**
 * Does this paste mean "an image was on the clipboard"?
 *
 * Only when it carried no text at all. A paste with text is a text paste, whatever else the clipboard
 * may also hold, because that is what the person saw themselves copy.
 */
export function isEmptyPaste(text: string): boolean {
  return text.length === 0;
}
