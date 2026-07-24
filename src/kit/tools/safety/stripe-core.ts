/**
 * stripe-core: project a risk level onto the danger-stripe marker. Safe shows nothing (the marker keeps
 * its signal by staying quiet); caution and danger show a leading bar with a label. Total and tolerant:
 * an out-of-range level fails toward danger (looks-dangerous), never throws. The level -> color mapping
 * lives in the tsx shell, so this core stays free of view tokens.
 */
import { assertNever } from "./assert-never";
import type { RiskLevel } from "./risk";

export interface StripeView {
  readonly level: RiskLevel;
  readonly label: string;
  readonly glyph: string; // the leading bar; "" for safe (nothing rendered)
  readonly show: boolean;
}

const BAR = "▌"; // left half block, matching the backstage spine

const LEVELS = new Set<RiskLevel>(["safe", "caution", "danger"]);
const isRiskLevel = (v: unknown): v is RiskLevel =>
  typeof v === "string" && LEVELS.has(v as RiskLevel);

const DANGER: StripeView = { level: "danger", label: "danger", glyph: BAR, show: true };

/** The stripe for a level. Out-of-range fails toward danger (fail toward looks-dangerous). */
export function stripeFor(level: RiskLevel): StripeView {
  if (!isRiskLevel(level)) return DANGER;
  switch (level) {
    case "safe":
      return { level, label: "safe", glyph: "", show: false };
    case "caution":
      return { level, label: "caution", glyph: BAR, show: true };
    case "danger":
      return DANGER;
    default:
      return assertNever("stripeFor", level);
  }
}
