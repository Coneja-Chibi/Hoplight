/**
 * cap: the one display-count cap for the nav cluster. A one-letter search over a long transcript,
 * or a fast stream while you are scrolled up, can push a count past what a small label should show;
 * both the match cursor's "k of n" and the new-below pill clamp their number through here so the two
 * never drift on where the ceiling sits. Pure, total, no I/O.
 */

/** The display ceiling for an inline count. Above it the number reads "99+" instead of the digits. */
export const CAP = 99;

/** Format a non-negative count for a compact label: the number, or "99+" once it passes the ceiling. */
export const cap99 = (n: number): string => (n > CAP ? `${CAP}+` : String(Math.max(0, Math.floor(n))));
