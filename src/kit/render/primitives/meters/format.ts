/**
 * compactTokens: the meter cluster's number formatter for token counts. Distinct from models.ts
 * formatContext (window SIZES, uppercase K/M, no decimals) by casing and rounding, so the two must
 * NOT be merged: token counts read as "13" / "1.4k" / "1.4M" (lowercase, one decimal for k/M). Pure
 * and total: NaN / Infinity / non-positive all render "0"; never throws.
 */

/** Round to one decimal, dropping a trailing ".0" so 1000 reads "1k", not "1.0k". */
const short = (value: number, suffix: string): string => {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${suffix}`;
};

/** A compact token count: integer below 1k, one-decimal k below 1M, one-decimal M above. */
export const compactTokens = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return short(n / 1_000_000, "M");
  if (n >= 1_000) return short(n / 1_000, "k");
  return String(Math.round(n));
};
