/** @jsxImportSource @opentui/react */
/**
 * StatusBar: the live working state (wireframe C2), a thin bar just above the composer. Left is the
 * connection: an alive dot + the provider and model, or a muted nudge to connect one. Right is the
 * turn state (ready / working). It never repeats what the playbill already carries (pieces, egress).
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";

export function StatusBar({
  provider,
  busy,
}: {
  provider: { name: string; model: string } | null;
  busy: boolean;
}): ReactNode {
  const { width } = useTerminalDimensions();
  const compact = width < 50;
  return (
    <box flexDirection="row" height={1} backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
      {provider ? (
        <text fg={theme.soft}>
          <span fg={theme.alive}>●</span> <span fg={theme.text}>{provider.name}</span>
          {compact ? null : ` ${provider.model}`}
        </text>
      ) : (
        <text fg={theme.mut}>
          {compact ? "○ /model to connect" : <span>○ no provider <span fg={theme.soft}>· /model to connect</span></span>}
        </text>
      )}
      <box flexGrow={1} />
      <text fg={busy ? theme.rose : theme.mut}>{busy ? "working" : "ready"}</text>
    </box>
  );
}
