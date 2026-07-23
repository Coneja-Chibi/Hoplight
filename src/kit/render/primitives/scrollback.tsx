/** @jsxImportSource @opentui/react */
/**
 * Scrollback: the transcript body between the strip and the input. A real scroll surface pinned to
 * the bottom, so streaming replies and long sessions never fall off the screen; scrolling up to
 * read history un-pins, and returning to the bottom re-pins.
 */
import type { ReactNode } from "react";

export function Scrollback({ children }: { children: ReactNode }): ReactNode {
  return (
    <scrollbox
      flexGrow={1}
      scrollY
      stickyScroll
      stickyStart="bottom"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      gap={1}
    >
      {children}
    </scrollbox>
  );
}
