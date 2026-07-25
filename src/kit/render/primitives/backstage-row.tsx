/** @jsxImportSource @opentui/react */
/**
 * BackstageRow, a sealed tool cluster (DECISIONS #26): collapsed by default to one compact, indented
 * line ("· Backstage · N moves · Ns · click or ctrl+o reopens"), tucked under the turn rather than
 * ballooning into a full-width band (Chi, 2026-07-24); clicking it (or ctrl+o for the latest trace)
 * reopens the moves in a bordered box, clicking the open box folds it back. A turn's tool work never
 * litters the transcript. Reopened moves keep their verb-palette color (see BackstageBox / colorForVerb).
 */
import type { ReactNode } from "react";
import { theme, colorForVerb } from "../theme";

function MoveRow({ raw }: { raw: string }): ReactNode {
  const verb = raw.match(/^\S+/)?.[0] ?? raw;
  const rest = raw.slice(verb.length);
  const color = colorForVerb(verb);
  return (
    <text fg={theme.soft}>
      <span fg={color}>{"▌ "}</span>
      <span fg={color}>{verb}</span>
      <span fg={theme.soft}>{rest}</span>
    </text>
  );
}

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
      <box flexDirection="row" paddingLeft={2} onMouseDown={onToggle}>
        <text fg={theme.soft}>
          <span fg={theme.tealDeep}>{"· "}</span>
          Backstage · {String(moves.length)} move{moves.length === 1 ? "" : "s"} · {String(seconds)}s ·{" "}
          <span fg={theme.teal}>click or ctrl+o</span> reopens
        </text>
      </box>
    );
  }
  return (
    <box flexDirection="column" border borderColor={theme.line} backgroundColor={theme.floor} onMouseDown={onToggle}>
      <box flexDirection="row" backgroundColor={theme.lift} paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>BACKSTAGE</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{String(seconds)}s · click folds it</text>
      </box>
      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        {moves.map((move, index) => (
          <MoveRow key={index} raw={move} />
        ))}
      </box>
    </box>
  );
}
