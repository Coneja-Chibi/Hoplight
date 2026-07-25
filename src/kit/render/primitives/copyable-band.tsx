/** @jsxImportSource @opentui/react */
/** CopyableBand: a normal transcript band with a hover-only copy corner layered without reflow. */
import { useState } from "react";
import type { ReactNode } from "react";
import { Band } from "./band";
import { CopyCorner } from "./copy-corner";

export function CopyableBand({
  bg,
  spine,
  onMouseDown,
  onCopy,
  children,
}: {
  bg: string;
  spine: string;
  onMouseDown?: () => void;
  onCopy?: () => void;
  children: ReactNode;
}): ReactNode {
  const [hovered, setHovered] = useState(false);
  return (
    <Band
      bg={bg}
      spine={spine}
      onMouseDown={onMouseDown}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      corner={onCopy ? <CopyCorner visible={hovered} onCopy={onCopy} /> : null}
    >
      {children}
    </Band>
  );
}
