/** @jsxImportSource @opentui/react */
/**
 * SessionCard: one row in the resume playbill. A dumb display of an already-summarized session: the
 * cursor + selection marker, the title, the turn count, a relative time, and a fork provenance subtitle
 * when the session branched from another. All values are precomputed by the pure cores; the card only
 * chooses tokens for selected vs unselected. Mirrors the transcript row primitives (tool-row, you-line).
 */
import type { ReactNode } from "react";
import { theme } from "../../render/theme";

export function SessionCard({
  title,
  turnCount,
  when,
  selected,
  parentTitle,
  parentTurn,
}: {
  title: string;
  turnCount: number;
  when: string;
  selected: boolean;
  parentTitle?: string;
  parentTurn?: number;
}): ReactNode {
  const turns = `${turnCount} turn${turnCount === 1 ? "" : "s"}`;
  const showParent = parentTurn !== undefined;
  return (
    <box flexDirection="column" backgroundColor={selected ? theme.row : theme.well} paddingLeft={1} paddingRight={1}>
      <box flexDirection="row">
        <text fg={selected ? theme.rose : theme.mut}>{selected ? "> " : "  "}</text>
        <text fg={selected ? theme.teal : theme.mut}>{selected ? "(*) " : "( ) "}</text>
        <text fg={selected ? theme.text : theme.soft}>{title}</text>
        <box flexGrow={1} />
        <text fg={theme.mut}>
          {turns} · {when}
        </text>
      </box>
      {showParent ? (
        <box flexDirection="row" paddingLeft={6}>
          <text fg={theme.mut}>
            forked from {parentTitle ? `"${parentTitle}"` : "(removed)"} @ turn {String(parentTurn)}
          </text>
        </box>
      ) : null}
    </box>
  );
}
