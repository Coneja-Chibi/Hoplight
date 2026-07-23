/** @jsxImportSource @opentui/react */
/**
 * Scrollback: the transcript body between the strip and the input. A real scroll surface pinned to
 * the bottom, so streaming replies and long sessions never fall off the screen; scrolling up to
 * read history un-pins, and returning to the bottom re-pins.
 */
import type { ReactNode } from "react";

export function Scrollback({ children }: { children: ReactNode }): ReactNode {
  // A plain flex-grow box takes the space between the fixed chrome (plain boxes shrink correctly);
  // the scrollbox fills it at a definite height and scrolls its content inside, so the transcript
  // never pushes the input/status off the bottom or bleeds over the playbill.
  return (
    <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0}>
      <scrollbox
        height="100%"
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
    </box>
  );
}
