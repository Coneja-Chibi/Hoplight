/**
 * confirm-phrase: the pure check behind type-to-confirm for destructive moves (Chi's fork 3, 2026-07-24).
 * A delete has no undo, so a keypress is not enough consent: the user must type the exact phrase Kit shows
 * (e.g. "delete 12"). requiredPhrase builds that phrase from a verb + count; matchesConfirm compares it to
 * what the user typed, whitespace- and case-normalized. Total and tolerant: any ragged input is simply
 * "not a match" (deny by absence), never a throw. The gate stays closed until the phrase matches exactly.
 */

/** The phrase the user must type to confirm a destructive move: the verb plus the count (e.g. "delete 12"). */
export const requiredPhrase = (verb: string, count: number): string => {
  const v = (typeof verb === "string" ? verb.trim().toLowerCase() : "") || "confirm";
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${v} ${n}`;
};

const normalize = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

/** True only when the typed input matches the required phrase exactly (normalized). Blank never matches. */
export const matchesConfirm = (required: unknown, input: unknown): boolean => {
  if (typeof required !== "string" || typeof input !== "string") return false;
  const want = normalize(required);
  return want.length > 0 && want === normalize(input);
};
