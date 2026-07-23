/** @jsxImportSource @opentui/react */
/**
 * Scrollback: the transcript body between the playbill and the composer. A plain flex-grow box takes
 * exactly the space between the fixed chrome (plain boxes distribute flex space cleanly, without the
 * off-by-one the scrollbox itself introduces); the scrollbox fills that box and scrolls its content
 * inside, so the transcript never pushes the input/status off the bottom or bleeds over the playbill.
 * stickyStart="bottom" keeps streaming replies pinned to the composer.
 */
import type { ReactNode } from "react";

export function Scrollback({ children }: { children: ReactNode }): ReactNode {
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
