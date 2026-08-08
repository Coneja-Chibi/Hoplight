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
      /**
       * The person's width wins, bounded by the terminal.
       *
       * `railWidth` is now the DEFAULT rather than the rule: it derives a sensible third-of-the-screen
       * on open, and Ctrl+Shift+Left/Right moves off it. The min() is the only thing the layout still
       * insists on - a rail wider than the window would push the transcript off the screen entirely.
       */
      width={Math.min(rail.width, Math.max(20, width - 24))}
      offset={rail.offset}
      /**
       * Dense fits every row it can; roomy keeps the chrome. The complaint was reading "45/155" with
       * no way to see the rest, and the honest fix is a choice rather than a bigger constant -
       * somebody scanning 155 blocks and somebody reading three want different screens.
       */
      height={rail.dense
        ? Math.max(3, height - 2)
        : Math.max(3, height - (rail.pending > 0 ? 3 : 2) - 4)}
      onRowDown={rail.onRowDown}
      onRowDrag={rail.onRowDrag}
      onRowDragEnd={rail.onRowDragEnd}
    />
  );
}
