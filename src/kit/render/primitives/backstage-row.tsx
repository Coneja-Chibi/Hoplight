/** @jsxImportSource @opentui/react */
/**
 * BackstageRow, a sealed tool cluster (DECISIONS #26): collapsed by default to one teal-accented line
 * ("backstage · N moves · Ns · click or ctrl+o reopens it"); clicking it (or ctrl+o for the latest
 * trace) reopens the moves, clicking the open box folds it back. A turn's tool work never litters
 * the transcript.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function BackstageRow({
  moves,
  seconds,
  open,
  onToggle,
}: {
  moves: string[];
  seconds: number;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  if (!open) {
    return (
      <box flexDirection="row" onMouseDown={onToggle}>
        <text fg={theme.mut}>
          backstage · {String(moves.length)} move{moves.length === 1 ? "" : "s"} · {String(seconds)}s ·{" "}
          <span fg={theme.teal}>click or ctrl+o</span> reopens it
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
      <box flexDirection="row" backgroundColor={theme.floor} paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>BACKSTAGE</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{String(seconds)}s · click folds it</text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) => (
          <text key={index} fg={theme.soft}>
            <span fg={theme.tealDeep}>{"▌ "}</span>
            {move}
          </text>
        ))}
      </box>
    </box>
  );
}
