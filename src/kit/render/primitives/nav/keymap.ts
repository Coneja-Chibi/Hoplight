/**
 * keymap: kept as the name the help stage and hint rows import, now backed by the table that
 * actually DISPATCHES.
 *
 * This file used to hold its own copy of the bindings and open by promising that "what help teaches
 * and what the keys actually do can never drift". Nothing enforced that: the rows here were read only
 * by the help screen and the footer, while every real handler was hand-written per component against
 * raw key events. Kit therefore advertised Shift+Enter, PgUp/PgDn, Home, End and ctrl+o whether or
 * not anything listened.
 *
 * The rows now live in `intent.ts` with an `intent` on each one, and a resolver turns a key into that
 * intent. Re-exporting rather than keeping a second list is the point: two lists is exactly the drift
 * the old header promised was impossible. `intent.test.ts` fails in CI if a row's chord cannot be
 * produced, so the promise is now checkable instead of aspirational.
 */
export { KEYMAP, bindingsFor, chordOf, intentOf } from "./intent";
export type { Intent, KeyLike, Keybinding } from "./intent";
