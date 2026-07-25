/** @jsxImportSource @opentui/react */
/**
 * BackstageRow: a sealed tool cluster that collapses to one compact receipt line and reopens to the
 * ordered move list. Scheduler lifecycle is retained with the trace, never inferred from prose.
 */
import type { ReactNode } from "react";
import type { LoopPhase } from "../../loop/state";
import { theme, colorForVerb } from "../theme";
import { lifecycleLabel } from "./lifecycle-label";

function MoveRow({ raw }: { raw: string }): ReactNode {
  const verb = raw.match(/^\S+/)?.[0] ?? raw;
  const rest = raw.slice(verb.length);
  const color = colorForVerb(verb);
  return (
    <text fg={theme.soft}>
      <span fg={color}>{"| "}</span>
      <span fg={color}>{verb}</span>
      <span fg={theme.soft}>{rest}</span>
    </text>
  );
}

export function BackstageRow({
  moves,
  seconds,
  phase,
  open,
  onToggle,
}: {
  moves: string[];
  seconds: number;
  phase?: LoopPhase;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  if (!open) {
    return (
      <box flexDirection="row" paddingLeft={2} onMouseDown={onToggle}>
        <text fg={theme.soft}>
          <span fg={theme.tealDeep}>{"· "}</span>
          Backstage · {String(moves.length)} move{moves.length === 1 ? "" : "s"}
          {phase ? <> · {lifecycleLabel(phase, true)}</> : null} · {String(seconds)}s ·{" "}
          <span fg={theme.teal}>click or ctrl+o</span> reopens
        </text>
      </box>
    );
  }
  return (
    <box
      flexDirection="column"
      border
      borderColor={theme.line}
      backgroundColor={theme.floor}
      onMouseDown={onToggle}
    >
      <box flexDirection="row" backgroundColor={theme.lift} paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>BACKSTAGE</text>
        {phase ? <text fg={theme.teal}> · {lifecycleLabel(phase)}</text> : null}
        <box flexGrow={1} />
        <text fg={theme.quiet}>{String(seconds)}s · click folds it</text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) => <MoveRow key={index} raw={move} />)}
      </box>
    </box>
  );
}
