/** @jsxImportSource @opentui/react */
/**
 * Masthead: the session's theatrical header (locked look, DECISIONS #23). Big block-letter "Kit."
 * with a rose period via OpenTUI's ascii-font, an uppercase studio kicker, and a rose-deep bottom
 * rule (the terminal-honest translation of the mockup's offset stamp shadow).
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
  const kicker = `studio · ${studioName} · ${totalPieces} pieces`.toUpperCase();
  return (
    <box
      flexDirection="column"
      backgroundColor={theme.panel}
      border={["bottom"]}
      borderColor={theme.roseDeep}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row">
        <ascii-font text="Kit" font="block" color={theme.text} />
        <ascii-font text="." font="block" color={theme.rose} />
      </box>
      <text fg={theme.mut}>{kicker}</text>
    </box>
  );
}
