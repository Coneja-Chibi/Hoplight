/** @jsxImportSource @opentui/react */
/**
 * StatusBar: the quiet lower register of the fused prompter rail. Left is the connection: an alive
 * dot plus the provider and model, or a quiet nudge to connect one. Right is the turn state. The
 * top-only seam joins it to the input plate without making a second box.
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";

export type ProviderStatus = { name: string; model: string } | null;

export function StatusBar({
  provider,
  busy,
}: {
  provider: ProviderStatus;
  busy: boolean;
}): ReactNode {
  const { width } = useTerminalDimensions();
  const compact = width < 50;
  return (
    <box
      flexDirection="row"
      height={2}
      backgroundColor={theme.floor}
      border={["top"]}
      borderColor={theme.seam}
      paddingLeft={1}
      paddingRight={1}
    >
      {provider ? (
        <text fg={theme.soft}>
          <span fg={theme.alive}>●</span> <span fg={theme.text}>{provider.name}</span>
          {compact ? null : ` ${provider.model}`}
        </text>
      ) : (
        <text fg={theme.quiet}>
          {compact ? "○ /model to connect" : <span>○ no provider <span fg={theme.soft}>· /model to connect</span></span>}
        </text>
      )}
      <box flexGrow={1} />
      <text fg={busy ? theme.rose : theme.quiet}>{busy ? "working" : "ready"}</text>
    </box>
  );
}
