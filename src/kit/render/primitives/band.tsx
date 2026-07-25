/** @jsxImportSource @opentui/react */
/**
 * Band: one message rendered as a shaded segment of the transcript. Tonal contrast carries the grouping
 * (your line lifts to `theme.lift`, replies recess) and a 1-col left spine names the role. No bottom
 * divider: per-line rules chopped a single turn into disjointed megablocks (Chi, 2026-07-24), so the
 * bg contrast plus the scrollback's row gap do the separating instead. onMouseDown threads foldable rows.
 */
import type { ReactNode } from "react";

export function Band({
  bg,
  spine,
  onMouseDown,
  onMouseOver,
  onMouseOut,
  corner,
  children,
}: {
  bg: string;
  spine: string;
  onMouseDown?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  corner?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <box
      flexDirection="row"
      backgroundColor={bg}
      onMouseDown={onMouseDown}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    >
      <box width={1} backgroundColor={spine} />
      <box position="relative" flexGrow={1} paddingLeft={1} paddingRight={1}>
        {children}
        {corner}
      </box>
    </box>
  );
}
