/** @jsxImportSource @opentui/react */
/**
 * Playbill: the persistent theatre marquee. Twinkling gold lamp rows frame NOW PLAYING, the studio,
 * piece count, and local-first promise. Live provider/context/token status sits beneath the bill without
 * replacing its personality. Small panes fall back to one compact line so chrome never eats the stage.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { TokenUsage } from "../../providers/usage";
import { theme } from "../theme";
import { ContextMeter } from "./meters/context-meter";
import { TokenTally } from "./meters/token-tally";
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
  totalPieces,
  provider,
  turnUsage,
  sessionUsage,
  contextMax,
}: {
  studioName: string;
  totalPieces: number;
  provider: { name: string; model: string } | null;
  turnUsage: TokenUsage;
  sessionUsage: TokenUsage;
  contextMax: number | undefined;
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
          <box flexGrow={1} />
          <text fg={theme.soft}>
            <span fg={theme.text}>{String(totalPieces)} pieces</span>
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
          <Centered>
            <text fg={theme.soft}>
              {String(totalPieces)} pieces in the wings · nothing leaves until you send
            </text>
          </Centered>
          <Lamps width={width} tick={tick} phase={6} />
        </box>
      )}
      {provider ? (
        <box
          flexDirection="row"
          backgroundColor={theme.floor}
          paddingLeft={1}
          paddingRight={1}
          border={["top"]}
          borderColor={theme.seam}
        >
          <ContextMeter consumed={turnUsage.input} max={contextMax} />
          <box flexGrow={1} />
          {!compact ? <TokenTally turn={turnUsage} session={sessionUsage} /> : null}
        </box>
      ) : null}
    </box>
  );
}
