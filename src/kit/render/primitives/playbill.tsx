/** @jsxImportSource @opentui/react */
/**
 * Playbill: the persistent theatre marquee. Twinkling gold lamp rows frame NOW PLAYING and the
 * studio name. Small panes fall back to one compact line so chrome never eats the stage.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { theme } from "../theme";
import { compactPlaybill, lampPattern } from "./playbill-core";

const TWINKLE_MS = 260;

const Centered = ({ children }: { children: ReactNode }): ReactNode => (
  <box flexDirection="row" height={1} justifyContent="center">
    {children}
  </box>
);

function Lamps({
  width,
  tick,
  phase,
}: {
  width: number;
  tick: number;
  phase: number;
}): ReactNode {
  return (
    <box flexDirection="row" height={1}>
      <text>
        {lampPattern(width, tick, phase).flatMap((lit, index) => [
          <span key={`lamp-${index}`} fg={lit ? theme.gold : theme.goldDim}>·</span>,
          <span key={`space-${index}`}> </span>,
        ])}
      </text>
    </box>
  );
}

export function Playbill({
  studioName,
}: {
  studioName: string;
}): ReactNode {
  const { width, height } = useTerminalDimensions();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (compactPlaybill(width, height)) return;
    const id = setInterval(() => setTick((value) => value + 1), TWINKLE_MS);
    return () => clearInterval(id);
  }, [width, height]);

  const compact = compactPlaybill(width, height);
  return (
    <box flexDirection="column">
      {compact ? (
        <box flexDirection="row" backgroundColor={theme.panel} paddingLeft={1} paddingRight={1}>
          <text>
            <b fg={theme.text}>Kit</b>
            <span fg={theme.rose}>.</span>
          </text>
        </box>
      ) : (
        <box flexDirection="column" backgroundColor={theme.panel}>
          <Lamps width={width} tick={tick} phase={0} />
          <Centered>
            <text fg={theme.rose}>N O W　 P L A Y I N G</text>
          </Centered>
          <Centered>
            <text fg={theme.text}>
              <span fg={theme.rose}>V</span> {studioName}
            </text>
          </Centered>
          <Lamps width={width} tick={tick} phase={6} />
        </box>
      )}
    </box>
  );
}
