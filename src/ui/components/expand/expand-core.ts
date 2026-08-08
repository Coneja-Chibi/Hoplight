/**
 * The pure rules behind the fullscreen editor box: what a caret is worth saving, when an Escape press
 * belongs to us, and where a trapped Tab lands. Separated from the component because these are the
 * parts that can be wrong in ways a screenshot never shows, and they test without a DOM.
 */

/** The slice of a text control these rules touch; a plain object satisfies it in tests. */
export interface TextTarget {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollTop: number;
  setSelectionRange(start: number, end: number): void;
}

/** Where the caret sat and how far the editor was scrolled, so a swap can put both back. */
export interface Caret {
  start: number;
  end: number;
  scrollTop: number;
}

/** Read the caret off a live control. A null selection (an unfocused control) means "the end". */
export function readCaret(el: TextTarget): Caret {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  return { start, end, scrollTop: el.scrollTop };
}

/**
 * A caret captured before the swap can outrun the text it belongs to - the value is a prop, and a
 * parent is free to shorten it while the box is open. Clamping keeps the restore from throwing the
 * caret somewhere the text no longer reaches.
 */
export function clampCaret(caret: Caret, length: number): Caret {
  const start = Math.max(0, Math.min(caret.start, length));
  const end = Math.max(start, Math.min(caret.end, length));
  return { start, end, scrollTop: Math.max(0, caret.scrollTop) };
}

/** Put a saved caret back on whichever control now holds the text. */
export function applyCaret(el: TextTarget, caret: Caret): void {
  const safe = clampCaret(caret, el.value.length);
  el.setSelectionRange(safe.start, safe.end);
  el.scrollTop = safe.scrollTop;
}

/** The keyboard-event fields the close rule reads. */
export interface CloseKeyEvent {
  key: string;
  defaultPrevented?: boolean;
  isComposing?: boolean;
}

/**
 * Escape closes the box - unless the editor inside already spent that press. CodeEditor's macro
 * popover calls preventDefault on Escape, and this box listens on document (bubble phase), so a
 * press the editor already used arrives here defaultPrevented: dismissing the popover must not also
 * throw away the fullscreen view. An IME cancel belongs to the editor for the same reason.
 */
export function isEscapeClose(e: CloseKeyEvent): boolean {
  if (e.key !== "Escape") return false;
  if (e.defaultPrevented) return false;
  return e.isComposing !== true;
}

/**
 * Where Tab goes while the box is open. null means the browser's own order already stays inside the
 * sheet, so leave it alone; anything else is the wrap-around, or a recovery when focus escaped the
 * sheet entirely (a scrim click, or a return from browser chrome).
 */
export function trapTarget<T>(focusables: readonly T[], active: T | null, backwards: boolean): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  const at = active === null ? -1 : focusables.indexOf(active);
  if (at === -1) return first;
  if (backwards) return at === 0 ? last : null;
  return at === focusables.length - 1 ? first : null;
}
