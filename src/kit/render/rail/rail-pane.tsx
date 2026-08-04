/** @jsxImportSource @opentui/react */
/**
 * The rail as the shell mounts it: session state in, one pane out.
 *
 * A seam rather than a component with opinions. The shell sits at its line cap and should not
 * learn the rail's prop shape, and the rail should not learn the shell's layout; this adapts one to
 * the other and owns the two things neither of them should decide alone - how wide the rail is on a
 * given terminal, and how many rows fit.
 */
import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { OutlineRail } from "../primitives/rail/outline-rail";
import type { RailSession } from "./use-rail";

/**
 * Wide enough for an index, a state dot and a recognisable name; never more than a third of the
 * screen, because the conversation is still the thing being had.
 */
const railWidth = (columns: number): number =>
  Math.max(24, Math.min(44, Math.floor(columns / 3)));

/**
 * How many rows the rail can draw, from the real terminal.
 *
 * ONE ANSWER, because there were two. The pane sliced by the terminal height while the cursor-scroll
 * logic used a hard-coded 20, so on a short window the cursor walked off the bottom with nothing
 * scrolling, and on a tall one the list scrolled while a third of it was still visible.
 *
 * Two chrome rows, plus one for the pending badge, plus the shell's own frame.
 */
export const railRowsVisible = (pending = 0): number => {
  const rows = process.stdout.rows ?? 24;
  return Math.max(3, rows - (pending > 0 ? 3 : 2) - 4);
};

export function RailPane({
  rail,
  contentOf,
}: {
  rail: RailSession;
  contentOf?: (id: string) => string | undefined;
}): ReactNode {
  const { width, height } = useTerminalDimensions();
  // Two chrome rows (header, footer), plus one for the pending badge when it is showing.
  return (
    <OutlineRail
      title={rail.title}
      rows={rail.state.rows}
      selected={rail.state.selected}
      cursor={rail.cursor}
      dropBefore={rail.dropBefore}
      focused={rail.focused}
      dragging={rail.dragging}
      expanded={rail.expanded}
      contentOf={contentOf}
      flags={rail.flags}
      pending={rail.pending}
      width={railWidth(width)}
      offset={rail.offset}
      height={Math.max(3, height - (rail.pending > 0 ? 3 : 2) - 4)}
      onRowDown={rail.onRowDown}
      onRowDrag={rail.onRowDrag}
      onRowDragEnd={rail.onRowDragEnd}
    />
  );
}
