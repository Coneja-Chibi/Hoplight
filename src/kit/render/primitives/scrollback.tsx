/** @jsxImportSource @opentui/react */
/**
 * Scrollback: the transcript body that fills the space between the strip and the input, holding the
 * conversation lines with breathing room between them.
 */
import type { ReactNode } from "react";

export function Scrollback({ children }: { children: ReactNode }): ReactNode {
  return (
    <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1} gap={1}>
      {children}
    </box>
  );
}
