/** @jsxImportSource @opentui/react */
/**
 * Playbill: the persistent header (wireframe E1, the "full bill"). A lit theatre marquee: gold lamp
 * rows frame a centered NOW PLAYING eyebrow, the studio title with the rose crossed-V mark, and the
 * pieces + egress line. It carries who/what; the status bar down low carries live state, so neither
 * repeats the other. Lamps fill the pane width; a hard rose rule seals the bottom edge (it stamps,
 * it does not float).
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";

const Centered = ({ children }: { children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1} justifyContent="center">
    {children}
  </box>
);

export function Playbill({ studioName, totalPieces }: { studioName: string; totalPieces: number }): ReactNode {
  const { width } = useTerminalDimensions();
  const lamps = "· ".repeat(Math.max(4, Math.floor((width - 2) / 2))).trimEnd();
  return (
    <box flexDirection="column" backgroundColor={theme.panel}>
      <Centered>
        <text fg={theme.gold}>{lamps}</text>
      </Centered>
      <Centered>
        <text fg={theme.rose}>N O W　 P L A Y I N G</text>
      </Centered>
      <Centered>
        <text fg={theme.text}>
          <span fg={theme.rose}>V</span> {studioName}
        </text>
      </Centered>
      <Centered>
        <text fg={theme.mut}>{String(totalPieces)} pieces in the wings · nothing leaves until you send</text>
      </Centered>
      <Centered>
        <text fg={theme.gold}>{lamps}</text>
      </Centered>
      <box height={1} backgroundColor={theme.roseDeep} />
    </box>
  );
}
