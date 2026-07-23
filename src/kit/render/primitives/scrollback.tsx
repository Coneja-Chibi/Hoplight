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
      >
        {/* Anchor content to the bottom so a short transcript hugs the composer (no dead space above
            it); when it overflows this box just grows and the scrollbox scrolls to the bottom. */}
        <box flexDirection="column" justifyContent="flex-end" minHeight="100%" gap={1}>
          {children}
        </box>
      </scrollbox>
    </box>
  );
}
