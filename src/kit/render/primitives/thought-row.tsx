/** @jsxImportSource @opentui/react */
/**
 * ThoughtRow, a landed rehearsal trace (DECISIONS #25): collapsed by default to one compact, indented
 * line ("· rehearsed for Ns · M chars · click or ctrl+o reopens"), tucked under the turn rather than
 * ballooning into a full-width band (Chi, 2026-07-24, "related things taking up one whole megablock");
 * clicking it, or ctrl+o for the latest trace, reopens the full thought in the rehearsal box. Clicking
 * the open trace folds it back. Text sits at `soft` (legible), never dim-grey.
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
      <box flexDirection="row" paddingLeft={2} onMouseDown={onToggle}>
        <text fg={theme.soft}>
          <span fg={theme.tealDeep}>{"· "}</span>
          rehearsed for {String(seconds)}s · {String(text.length)} chars ·{" "}
          <span fg={theme.rose}>click or ctrl+o</span> reopens
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
        <text fg={theme.soft}>REHEARSAL</text>
        <box flexGrow={1} />
        <text fg={theme.quiet}>{String(seconds)}s · click folds it</text>
      </box>
      <box paddingLeft={1} paddingRight={1}>
        <text fg={theme.soft}>{text}</text>
      </box>
    </box>
  );
}
