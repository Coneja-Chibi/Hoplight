/** @jsxImportSource @opentui/react */
/**
 * BackstageBox, the live tool cluster (DECISIONS #26): while a turn makes moves, they gather in a
 * bordered box under a legible BACKSTAGE header carrying a running move count. Each move is a structured
 * row whose verb (and spine) is colored by a classic menu palette (cool = safe reads, warm = writes,
 * red = destructive, violet = egress; locked with Chi 2026-07-24), so a slow tool is named on stage in
 * its own color while it grinds. A running move (no summary yet) pulses middots; a settled move shows its
 * one-line summary. The box seals into a foldable line when the model speaks (see BackstageRow).
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme, colorForVerb } from "../theme";
import type { ToolMove } from "../turn-events";

const DOTS = [" ·  ", " ·· ", " ···"];

/** Split a move line into its verb (first token, colored by palette) and the rest (soft). */
function MoveRow({ raw, running, dots }: { raw: string; running: boolean; dots: string }): ReactNode {
  const verb = raw.match(/^\S+/)?.[0] ?? raw;
  const rest = raw.slice(verb.length);
  const color = colorForVerb(verb);
  return (
    <text fg={theme.soft}>
      <span fg={color}>{"▌ "}</span>
      <span fg={color}>{verb}</span>
      <span fg={theme.soft}>{rest}</span>
      {running ? <span fg={color}>{dots}</span> : null}
    </text>
  );
}

export function BackstageBox({ moves }: { moves: ToolMove[] }): ReactNode {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((prev) => prev + 1), 220);
    return () => clearInterval(timer);
  }, []);
  const dots = DOTS[tick % DOTS.length]!;
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor}>
      <box flexDirection="row" backgroundColor={theme.lift} paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>BACKSTAGE</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>
          {String(moves.length)} move{moves.length === 1 ? "" : "s"}
        </text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) => (
          <MoveRow key={index} raw={move.summary ?? move.name} running={move.summary === undefined} dots={dots} />
        ))}
      </box>
    </box>
  );
}
