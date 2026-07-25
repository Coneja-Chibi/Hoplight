/**
 * contextMeter: the pure geometry + pressure zoning behind the Context Meter bar. Two numbers in
 * (consumed this session, the active model's max window) plus a cell width, one discriminated view
 * model out: known (with pct/zone/filled/empty for the bar) or unknown (count-only, no denominator).
 * The zone is the meter's actual job, mirroring ST's amber@90 / red@100. Pure and total: no I/O, no
 * clock, never throws; every ragged input is re-guarded here even though readUsage cleans upstream.
 */

export type Zone = "calm" | "warn" | "crit";

/** Amber and red thresholds on the RAW ratio (overflow past 100% forces crit). */
export const WARN_AT = 0.9;
export const CRIT_AT = 1.0;

export type ContextMeter =
  | { readonly known: false; readonly consumed: number }
  | {
      readonly known: true;
      readonly consumed: number;
      readonly max: number;
      readonly pct: number;
      readonly zone: Zone;
      readonly filled: number;
      readonly empty: number;
    };

/** A finite, non-negative number, or 0. */
const nonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Build the view model. Unknown / non-positive max -> count-only (never a divide-by-zero). Otherwise
 * pct is the ratio clamped to [0,1] for the bar while the zone is read from the raw ratio, so an
 * overflow surfaces as crit without overflowing the cells. filled+empty === width holds for width>=1;
 * width<1 yields filled 0, empty 0.
 */
export const contextMeter = (consumed: number, max: number | undefined, width: number): ContextMeter => {
  const used = nonNeg(consumed);
  if (max === undefined || !Number.isFinite(max) || max <= 0) {
    return { known: false, consumed: used };
  }
  const ratio = used / max;
  const pct = Math.min(1, Math.max(0, ratio));
  const zone: Zone = ratio >= CRIT_AT ? "crit" : ratio >= WARN_AT ? "warn" : "calm";
  const cells = width >= 1 ? Math.floor(width) : 0;
  const filled = Math.min(cells, Math.max(0, Math.round(pct * cells)));
  const empty = cells - filled;
  return { known: true, consumed: used, max, pct, zone, filled, empty };
};
