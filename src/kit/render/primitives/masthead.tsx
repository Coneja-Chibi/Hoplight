/** @jsxImportSource @opentui/react */
/**
 * Masthead: the signature stack (DECISIONS #27, design bible Pattern #1), terminal-translated:
 * a rose eyebrow (tracked uppercase) over the "Kit." wordmark, closed by a hard rose-deep rule.
 * The confiding line lives just below in the shell, in bright ink. No big display font (a terminal
 * can only fake that as chunky block letters); the wordmark carries at cell size.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function Masthead({
  studioName,
  totalPieces,
}: {
  studioName: string;
  totalPieces: number;
}): ReactNode {
  const eyebrow = `studio · ${studioName} · ${totalPieces} pieces`.toUpperCase();
  return (
    <box flexDirection="column" backgroundColor={theme.sunken}>
      <box flexDirection="row" height={1} paddingLeft={1} paddingRight={1}>
        <text fg={theme.rose}>{eyebrow}</text>
      </box>
      <box flexDirection="row" height={1} paddingLeft={1} paddingRight={1}>
        <text>
          <span fg={theme.text}>Kit</span>
          <span fg={theme.rose}>.</span>
        </text>
      </box>
      <box height={1} backgroundColor={theme.roseDeep} />
    </box>
  );
}
