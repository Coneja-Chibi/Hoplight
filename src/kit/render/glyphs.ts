/**
 * Kit's icon vocabulary: the glyphs that carry an action, so a choice row never prints bare letters.
 *
 * WHY GLYPHS AND NOT KEYS. A confirm whose options are `[y] allow once  [a] allow all session  [n]
 * deny` gives six bracketed letters the same weight, none of them shaped like what they do. The
 * shortcuts still work - they are simply no longer printed, because the binding belongs to muscle
 * memory and the row belongs to meaning.
 *
 * WHY THIS SET AND NOT A RICHER ONE. Terminal glyph width is decided by the font and the emulator,
 * not by us, and a double-width glyph inside a fixed-column row shears every character after it.
 * There is no width API to ask, so the set is chosen from evidence instead:
 *
 *   - U+25xx geometric shapes and block elements are ALREADY rendered by Kit today (the ▌ risk
 *     stripe, the ● alive dot, the █ meters), so their width is proven on the real surface.
 *   - CHECK and CROSS are outside that block. They are kept because every mainstream CLI prints
 *     them and no substitute reads as clearly, but they are the two to eyeball first if a row ever
 *     looks sheared.
 *
 * Deliberately NOT used, and named by codepoint because the repo's own emoji guard rejects the
 * literal - which is the point: U+26A0 routinely takes emoji presentation and renders double-width.
 * Also excluded are U+232B, U+2315, U+238B, U+27F3 and U+2298 (misc technical, unproven here).
 * Where one of those was the obvious pick a geometric shape stands in: warning is a solid triangle,
 * lock-down is a solid square, and "held for the session" is a ringed dot rather than a second tick.
 */

/** Affirmative. */
export const CHECK = "✓";
/** Negative. */
export const CROSS = "✗";
/** Held open for the rest of the session: a dot inside a ring, not a second tick. */
export const HELD = "◉";
/** Hard stop. A filled square reads as a wall in a way an outline never does. */
export const STOP = "■";
/** Needs a person. Solid triangle, the warning shape, from the proven block. */
export const ALERT = "▲";
/** State on / off. */
export const ON = "●";
export const OFF = "○";
/** Disclosure. */
export const OPEN = "▾";
export const CLOSED = "▸";
/** Selection marker for a list row. */
export const MARK = "◆";
/** The risk stripe, shared with stripe-core so the two can never drift. */
export const BAR = "▌";

/**
 * Every glyph, for the one test that has to fail loudly if a future edit smuggles in a character
 * from outside the vetted ranges.
 */
export const GLYPHS = {
  CHECK, CROSS, HELD, STOP, ALERT, ON, OFF, OPEN, CLOSED, MARK, BAR,
} as const;
