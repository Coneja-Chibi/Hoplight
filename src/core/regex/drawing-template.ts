/**
 * Turning a drawing into a regex REPLACEMENT - the mechanical half a model reliably gets wrong.
 *
 * THE SHAPE OF THE WORK. Somebody designs the rich thing once, as a drawing; a regex then renders it
 * from whatever compact form the model is asked to write, so the visual complexity lives in the
 * script rather than in every reply. The pattern is the interesting half and belongs to whoever is
 * writing it. The replacement is not interesting at all - it is four thousand characters of markup
 * that must become one line with every `$` doubled and every slot swapped for a capture reference -
 * and that is exactly the sort of transcription that comes back subtly wrong: one un-doubled `$`
 * turns into an empty string at render time, and a stray newline breaks the SillyTavern wire form.
 *
 * ORDER IS LOAD-BEARING. Escaping happens FIRST and slot substitution second, so the `$1` this
 * writes is a real capture reference while a `$` the author wrote stays a literal dollar sign.
 * Doing it the other way round doubles our own markers and the rule silently prints "$$1".
 */

/** A place in the drawing that a capture fills. */
export interface TemplateSlot {
  /** the literal text in the drawing, e.g. "{{NAME}}" */
  readonly mark: string;
  /** capture group number, 1-based */
  readonly group: number;
}

export interface BuiltReplacement {
  readonly replace: string;
  /** Slots that appear in no drawing, so the rule would print a group nobody sees. */
  readonly unusedSlots: string[];
  /** Marks left in the output that look like slots but were not declared. */
  readonly unfilled: string[];
  readonly warnings: string[];
}

/** `$` is the replacement language's only escape; doubling it is how a literal one survives. */
export const escapeReplacement = (text: string): string => text.replace(/\$/g, "$$$$");

/**
 * Collapse a document to one line, which is what a rule row can hold.
 *
 * EVERY RUN OF WHITESPACE BECOMES ONE SPACE, and never nothing. Deleting the whitespace BETWEEN
 * tags looks harmless and is not: a pretty-printed drawing puts a newline between `</b>` and
 * `<span>`, that newline is a rendered space, and removing it prints "Hardlocks" on every message
 * from then on. One space renders identically to the drawing, and CSS does not care.
 *
 * A drawing containing <pre> or <textarea> is left alone: those are the elements where a newline is
 * content, and silently reflowing one is worse than a long line.
 */
export function oneLine(html: string): { text: string; kept: boolean } {
  if (/<(pre|textarea)\b/i.test(html)) return { text: html, kept: true };
  return { text: html.replace(/\s+/g, " ").trim(), kept: false };
}

/** Anything shaped like a slot, so an undeclared one can be named rather than shipped. */
const SLOT_SHAPE = /\{\{[A-Za-z0-9_ .-]{1,40}\}\}/g;

/**
 * Build the replacement string for a drawing.
 *
 * `flatten` defaults on: a rule row is one line in every format this writes.
 */
export function buildReplacement(
  html: string,
  slots: readonly TemplateSlot[],
  flatten = true,
): BuiltReplacement {
  const warnings: string[] = [];
  let text = html;

  if (flatten) {
    const { text: flat, kept } = oneLine(text);
    text = flat;
    if (kept) {
      warnings.push(
        "left on several lines: this drawing has a <pre> or <textarea>, where a line break is "
        + "content. Some platforms cannot hold a multi-line replacement - check yours before saving.",
      );
    }
  }

  text = escapeReplacement(text);

  const unusedSlots: string[] = [];
  for (const slot of slots) {
    if (!text.includes(slot.mark)) {
      unusedSlots.push(slot.mark);
      continue;
    }
    text = text.split(slot.mark).join(`$${slot.group}`);
  }

  const unfilled = [...new Set(text.match(SLOT_SHAPE) ?? [])];
  if (unusedSlots.length > 0) {
    warnings.push(
      `not found in the drawing: ${unusedSlots.join(", ")}. That capture would go nowhere, so `
      + "either the mark is spelled differently in the drawing or the slot is left over.",
    );
  }
  if (unfilled.length > 0) {
    warnings.push(
      `left in the output as literal text: ${unfilled.join(", ")}. If those are meant to be `
      + "filled, declare a slot for each; if they are macros for another engine, they are fine.",
    );
  }

  return { replace: text, unusedSlots, unfilled, warnings };
}

/** How many capture groups a pattern actually opens, so a slot cannot point at a group that isn't there. */
export function countCaptureGroups(find: string): number {
  // Non-capturing "(?:", lookarounds "(?=" "(?!" "(?<=" "(?<!" and escaped "\(" do not count;
  // a named group "(?<name>" does. Character classes are skipped so "[(]" is not miscounted.
  let count = 0;
  let inClass = false;
  for (let i = 0; i < find.length; i += 1) {
    const ch = find[i];
    if (ch === "\\") { i += 1; continue; }
    if (inClass) { if (ch === "]") inClass = false; continue; }
    if (ch === "[") { inClass = true; continue; }
    if (ch !== "(") continue;
    const next = find.slice(i + 1, i + 4);
    if (!next.startsWith("?")) { count += 1; continue; }
    if (/^\?<[A-Za-z_]/.test(next)) count += 1; // named capture
  }
  return count;
}

/** Slots asking for a group the pattern never opens - the rule would print an empty string. */
export function slotsBeyondPattern(
  find: string,
  slots: readonly TemplateSlot[],
): { group: number; groups: number }[] {
  const groups = countCaptureGroups(find);
  return slots.filter((slot) => slot.group > groups).map((slot) => ({ group: slot.group, groups }));
}
