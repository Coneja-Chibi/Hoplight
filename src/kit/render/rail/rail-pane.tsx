/** @jsxImportSource @opentui/react */
/**
 * The rail as the shell mounts it: session state in, one pane out.
 *
 * A seam rather than a component with opinions. The shell is nine lines under its cap and should not
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

export function RailPane({
  rail,
  contentOf,
}: {
  rail: RailSession;
  contentOf?: (id: string) => string | undefined;
}): ReactNode {
  const { width, height } = useTerminalDimensions();
  // Two chrome rows (header, footer), plus one for the pending badge when it is showing.
  const chrome = rail.pending > 0 ? 3 : 2;
  return (
    <OutlineRail
      title={rail.title}
      rows={rail.state.rows}
      selected={rail.state.selected}
      cursor={rail.cursor}
      dropBefore={rail.dropBefore}
      dragging={rail.dragging}
      expanded={rail.expanded}
      contentOf={contentOf}
      flags={rail.flags}
      pending={rail.pending}
      width={railWidth(width)}
      offset={rail.offset}
      height={Math.max(3, height - chrome - 4)}
      onRowDown={rail.onRowDown}
      onRowDrag={rail.onRowDrag}
      onRowDragEnd={rail.onRowDragEnd}
    />
  );
}
