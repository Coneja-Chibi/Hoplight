/** @jsxImportSource @opentui/react */
/**
 * TurnRow: one turn inside the rewind rail. A dumb display of a precomputed TurnBound preview with the
 * cursor + "here" marker on the targeted row. Selected vs unselected is the only choice it makes; the
 * ordinal and preview come from the pure turnBounds projection.
 */
import type { ReactNode } from "react";
import { theme } from "../../render/theme";

export function TurnRow({
  turn,
  preview,
  selected,
}: {
  turn: number;
  preview: string;
  selected: boolean;
}): ReactNode {
  return (
    <box flexDirection="row" backgroundColor={selected ? theme.row : theme.floor} paddingLeft={1} paddingRight={1}>
      <text fg={selected ? theme.rose : theme.mut}>{selected ? "> " : "  "}</text>
      <text fg={theme.mut}>{String(turn)}  </text>
      <text fg={theme.soft}>you  </text>
      <text fg={selected ? theme.text : theme.soft}>{preview}</text>
      <box flexGrow={1} />
      {selected ? <text fg={theme.teal}>here</text> : null}
    </box>
  );
}
