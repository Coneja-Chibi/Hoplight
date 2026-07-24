/** @jsxImportSource @opentui/react */
/**
 * ThoughtRow, a landed rehearsal trace (DECISIONS #25): collapsed by default to one quiet line
 * ("rehearsed for Ns · M chars · click or ctrl+o reopens it"); clicking it, or ctrl+o for the
 * latest trace, reopens the full thought in the rehearsal box style. Clicking the open trace folds
 * it back. The thought never squats on the transcript uninvited.
 */
import type { ReactNode } from "react";
import { theme } from "../theme";

export function ThoughtRow({
  text,
  seconds,
  open,
  onToggle,
}: {
  text: string;
  seconds: number;
  open: boolean;
  onToggle: () => void;
}): ReactNode {
  if (!open) {
    return (
      <box flexDirection="row" onMouseDown={onToggle}>
        <text fg={theme.mut}>
          rehearsed for {String(seconds)}s · {String(text.length)} chars ·{" "}
          <span fg={theme.rose}>click or ctrl+o</span> reopens it
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
        <text fg={theme.mut}>REHEARSAL</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>{String(seconds)}s · click folds it</text>
      </box>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={theme.mut}>{text}</text>
      </box>
    </box>
  );
}
