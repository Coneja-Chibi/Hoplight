/**
 * The rules Kit's transcript markdown obeys, restated for a surface that has a DOM.
 *
 * THE PARSER IS NOT HERE, AND THAT IS THE POINT. src/kit/render/markdown.ts already turns a reply
 * into blocks and spans, it is pure, and it has its own tests. Copying it would be the duplicated
 * authority kit-vars.ts was written to avoid: two parsers, one of them quietly wrong, and nothing
 * that fails when they drift. This file holds only what the terminal did not need - a link policy,
 * because a terminal cannot navigate and a browser can.
 *
 * What IS pinned here is Kit's own cap on how much of a fenced patch gets drawn, so a window and a
 * terminal cut a huge diff at the same line.
 */
import { isSafeHref } from "../_shared/render-policy";

/**
 * How many diff rows a fenced patch may draw before the rest becomes a count.
 *
 * Kit's number, from src/kit/render/primitives/markdown-text.tsx. A model asked to "show me the
 * change" can emit a three thousand line patch, and a transcript that renders all of it is a
 * transcript you cannot scroll back through. Eighty is enough to read a hunk and see its shape.
 */
export const DIFF_LINE_CAP = 80;

/**
 * Schemes an anchor built from MODEL OUTPUT may carry.
 *
 * STRICTER THAN THE APP'S OWN POLICY, deliberately. `isSafeHref` also passes `#fragment` and
 * `/root-relative`, which is correct for a creator's card note rendered inside a preview frame and
 * wrong here: this window is the app itself, so a model that wrote `[click](/settings)` would be
 * writing a navigation instruction into somebody's chat log. An explicit outward scheme is required,
 * so the only thing a link can do is leave.
 */
const OUTWARD = /^(?:https?|mailto):/i;

/** Everything at or below U+0020: the C0 controls, tab, newline, and the space itself. */
const BLANKS = /[\u0000-\u0020]/g;

/**
 * The href an anchor may carry, or null when the link must be drawn as inert text.
 *
 * NULL IS THE NORMAL ANSWER FOR ANYTHING SUSPICIOUS. `javascript:`, `data:`, `vbscript:` and
 * `file:` all land here, as does anything wearing whitespace or a control character to hide its
 * scheme - a browser strips those before it resolves a URL, so the check must strip them first too
 * or it is checking a different string than the one that will be followed. `java\nscript:alert(1)`
 * navigates in every browser and passes a plain trim, which is exactly the shape a smuggled scheme
 * takes.
 *
 * Composed with the app's own allowlist rather than restating it: if `isSafeHref` ever tightens,
 * this tightens with it.
 */
export function safeLinkHref(href: string): string | null {
  const stripped = href.replace(BLANKS, "");
  if (stripped === "") return null;
  if (!OUTWARD.test(stripped)) return null;
  return isSafeHref(stripped) ? stripped : null;
}

/**
 * The ink a diff row takes, as a Kit palette variable.
 *
 * Kit's assignment exactly (markdown-text.tsx `diffColor`): additions alive-green, removals red,
 * hunk headers and file markers violet, everything else the body floor. The colours are the diff -
 * a patch drawn in one colour is just indented text.
 */
export function diffInk(kind: "meta" | "add" | "remove" | "context"): string {
  if (kind === "add") return "var(--kit-alive)";
  if (kind === "remove") return "var(--kit-red)";
  if (kind === "meta") return "var(--kit-violet)";
  return "var(--kit-soft)";
}
