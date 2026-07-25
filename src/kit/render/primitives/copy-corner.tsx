/** @jsxImportSource @opentui/react */
/** CopyCorner: the small hover-only transcript affordance; the parent owns clipboard feedback. */
import type { MouseEvent } from "@opentui/core";
import type { ReactNode } from "react";
import { theme } from "../theme";

export function CopyCorner({
  visible,
  onCopy,
}: {
  visible: boolean;
  onCopy: () => void;
}): ReactNode {
  if (!visible) return null;
  const copy = (event: MouseEvent): void => {
    event.stopPropagation();
    onCopy();
  };
  return (
    <box
      position="absolute"
      top={0}
      right={0}
      backgroundColor={theme.panel}
      paddingLeft={1}
      paddingRight={1}
      onMouseDown={copy}
    >
      <text fg={theme.quiet}>
        copy <span fg={theme.rose}>y</span>
      </text>
    </box>
  );
}
