/** @jsxImportSource @opentui/react */
/**
 * Masthead: the session's header, a compact "Kit." bar (wordmark left, studio right) over a
 * rose-deep bottom rule, the session's accent. Terminal-honest small mixed-case, matching the nav
 * header, not the browser mockup's oversized display font (which a terminal can only fake as chunky
 * all-caps block letters).
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
  return (
    <box
      flexDirection="row"
      backgroundColor={theme.panel}
      border={["bottom"]}
      borderColor={theme.roseDeep}
      paddingLeft={1}
      paddingRight={1}
    >
      <text>
        <span fg={theme.text}>Kit</span>
        <span fg={theme.rose}>.</span>
      </text>
      <box flexGrow={1} />
      <text fg={theme.mut}>
        studio <span fg={theme.soft}>{studioName}</span> <span fg={theme.rose}>·</span>{" "}
        <span fg={theme.soft}>{String(totalPieces)}</span> pieces
      </text>
    </box>
  );
}
