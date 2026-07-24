/** @jsxImportSource @opentui/react */
/**
 * Playbill: the persistent header (wireframe E1, the "full bill"). A lit theatre marquee: gold lamp
 * rows (dim base, a sparse moving set twinkling up to bright) frame a centered NOW PLAYING eyebrow,
 * the studio title with the rose crossed-V mark, and the legible pieces + egress line. It carries
 * who/what; the status bar down low carries live state, so neither repeats the other. Lamps fill the
 * pane width, edge to edge.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";

const Centered = ({ children }: { children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1} justifyContent="center">
    {children}
  </box>
);

const TWINKLE_MS = 260;

export function Playbill({ studioName, totalPieces }: { studioName: string; totalPieces: number }): ReactNode {
  const { width } = useTerminalDimensions();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), TWINKLE_MS);
    return () => clearInterval(id);
  }, []);

  const dots = Math.ceil(width / 2);
  const Lamps = ({ phase }: { phase: number }): ReactNode => {
    const cells: ReactNode[] = [];
    for (let i = 0; i < dots; i += 1) {
      // a sparse set of dots is lit at any moment, and the set drifts, so the row twinkles
      const lit = (i * 5 + tick + phase) % 11 === 0;
      cells.push(
        <span key={i} fg={lit ? theme.gold : theme.goldDim}>
          ·
        </span>,
      );
      cells.push(<span key={`s${i}`}> </span>);
    }
    return (
      <box flexDirection="row" height={1}>
        <text>{cells}</text>
      </box>
    );
  };

  return (
    <box flexDirection="column" backgroundColor={theme.panel}>
      <Lamps phase={0} />
      <Centered>
        <text fg={theme.rose}>N O W　 P L A Y I N G</text>
      </Centered>
      <Centered>
        <text fg={theme.text}>
          <span fg={theme.rose}>V</span> {studioName}
        </text>
      </Centered>
      <Centered>
        <text fg={theme.soft}>{String(totalPieces)} pieces in the wings · nothing leaves until you send</text>
      </Centered>
      <Lamps phase={6} />
    </box>
  );
}
