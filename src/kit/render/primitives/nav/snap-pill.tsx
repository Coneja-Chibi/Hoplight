/** @jsxImportSource @opentui/react */
/**
 * SnapPill: the new-below indicator that floats above the composer when you have scrolled up and the
 * model has streamed new lines beneath you. It is the affordance that makes snap-to-latest
 * discoverable (the way the composer's ghost preview makes the draft stash discoverable). It renders
 * nothing until there is something unseen; a click runs the same snapToBottom the End key does. The
 * count is capped for display by newBelowLabel so the pill stays one short line.
 */
import type { ReactNode } from "react";
import { theme } from "../../theme";
import { newBelowLabel } from "./scroll-seam";

export function SnapPill({
  show,
  unseen,
  onSnap,
}: {
  show: boolean;
  unseen: number;
  onSnap: () => void;
}): ReactNode {
  if (!show) return null;
  return (
    <box flexDirection="row" backgroundColor={theme.well} paddingLeft={1} paddingRight={1}>
      <box flexGrow={1} />
      <box backgroundColor={theme.roseDeep} paddingLeft={1} paddingRight={1} onMouseDown={onSnap}>
        <text fg={theme.white}>
          <span fg={theme.white}>{"v "}</span>
          {newBelowLabel(unseen)}
        </text>
      </box>
      <box flexGrow={1} />
    </box>
  );
}
