/** @jsxImportSource @opentui/react */
/**
 * MeterBar: the composed status-chrome row, the single widget app.tsx drops in above the StatusBar.
 * Context meter on the left, token tally on the right, a flex spacer between. Takes the turn view's
 * usage plus the resolved max-context; owns no logic beyond placement.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import type { TokenUsage } from "../../../providers/usage";
import { ContextMeter } from "./context-meter";
import { TokenTally } from "./token-tally";

export function MeterBar({
  usage,
  maxContext,
}: {
  usage: { turn: TokenUsage; session: TokenUsage; context: number };
  maxContext: number | undefined;
}): ReactNode {
  return (
    <box flexDirection="row" height={1} backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
      <ContextMeter consumed={usage.context} max={maxContext} />
      <box flexGrow={1} />
      <TokenTally turn={usage.turn} session={usage.session} />
    </box>
  );
}
