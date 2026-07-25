/** @jsxImportSource @opentui/react */
/**
 * DangerStripe: the risk marker as a leading colored bar. Safe renders nothing (the marker keeps its
 * signal by staying quiet); caution is amber (theme.gold), danger is red (theme.rose). The level ->
 * color mapping lives here; the pure stripe-core decides only weight/label/show. Colors are theme
 * tokens only (house rule + no-hardcode-colors guard). Returns an inline span so it can lead a peek
 * title or a backstage move row (the same surface reuse the cluster is designed for).
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import type { StripeView } from "../../../tools/safety/stripe-core";

export function DangerStripe({
  stripe,
  showLabel = false,
}: {
  stripe: StripeView;
  showLabel?: boolean;
}): ReactNode {
  if (!stripe.show) return null;
  const color = stripe.level === "caution" ? theme.gold : theme.rose;
  return (
    <span fg={color}>
      {stripe.glyph}
      {showLabel ? ` ${stripe.label} ` : " "}
    </span>
  );
}
