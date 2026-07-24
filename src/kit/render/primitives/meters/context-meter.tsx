/** @jsxImportSource @opentui/react */
/**
 * ContextMeter: the thin shell that paints the context-fullness bar from the pure view model. Zone
 * maps to the theme pressure colors (calm teal / warn gold / crit rose); a crit meter tails a "compact
 * due" marker. An unknown max renders count-only, no bar (deny by absence). No logic lives here.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import { compactTokens } from "./format";
import { contextMeter, type Zone } from "./context-meter-core";

const ZONE_INK: Record<Zone, string> = {
  calm: theme.teal,
  warn: theme.gold,
  crit: theme.rose,
};

const BAR_WIDTH = 18;

export function ContextMeter({
  consumed,
  max,
  width = BAR_WIDTH,
}: {
  consumed: number;
  max: number | undefined;
  width?: number;
}): ReactNode {
  const meter = contextMeter(consumed, max, width);
  if (!meter.known) {
    return (
      <text fg={theme.soft}>
        <span fg={theme.mut}>ctx</span> {compactTokens(meter.consumed)}
      </text>
    );
  }
  const dim = meter.consumed === 0;
  const fillInk = dim ? theme.mut : ZONE_INK[meter.zone];
  const pct = Math.round(meter.pct * 100);
  return (
    <text fg={theme.soft}>
      <span fg={theme.mut}>ctx</span>{" "}
      <span fg={theme.mut}>|</span>
      <span fg={fillInk}>{"#".repeat(meter.filled)}</span>
      <span fg={theme.mut}>{".".repeat(meter.empty)}</span>
      <span fg={theme.mut}>|</span>{" "}
      <span fg={dim ? theme.mut : theme.text}>{pct}%</span>{" "}
      {compactTokens(meter.consumed)} / {compactTokens(meter.max)}
      {meter.zone === "crit" ? <span fg={theme.rose}>{"  compact due"}</span> : null}
    </text>
  );
}
