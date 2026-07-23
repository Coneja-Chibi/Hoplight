/** @jsxImportSource @opentui/react */
/**
 * BackstageBox, the live tool cluster (DECISIONS #26): while a turn makes moves, they gather in a
 * seam-bordered box under a slim BACKSTAGE header carrying a running move count. A running move
 * (no summary yet) pulses teal middots so a slow tool is named on stage while it grinds; a settled
 * move shows a teal spine and its one-line summary. The box seals into a foldable line when the
 * model speaks (see BackstageRow).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../theme";
import type { ToolMove } from "../turn-events";

const DOTS = [" ·  ", " ·· ", " ···"];

export function BackstageBox({ moves }: { moves: ToolMove[] }): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 220);
    return () => clearInterval(timer);
  }, []);
  const dots = DOTS[tick % DOTS.length];
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>BACKSTAGE</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>
          {String(moves.length)} move{moves.length === 1 ? "" : "s"}
        </text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) =>
          move.summary === undefined ? (
            <text key={index} fg={theme.mut}>
              <span fg={theme.teal}>{"▌ "}</span>
              {move.name} <span fg={theme.teal}>{dots}</span>
            </text>
          ) : (
            <text key={index} fg={theme.soft}>
              <span fg={theme.tealDeep}>{"▌ "}</span>
              {move.summary}
            </text>
          ),
        )}
      </box>
    </box>
  );
}
