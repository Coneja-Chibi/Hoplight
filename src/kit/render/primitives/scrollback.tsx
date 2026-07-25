/** @jsxImportSource @opentui/react */
/**
 * Scrollback: the transcript body between the playbill and the composer. A plain flex-grow box takes
 * exactly the space between the fixed chrome (plain boxes distribute flex space cleanly, without the
 * off-by-one the scrollbox itself introduces); the scrollbox fills that box and scrolls its content
 * inside, so the transcript never pushes the input/status off the bottom or bleeds over the playbill.
 * stickyStart="bottom" keeps streaming replies pinned to the composer.
 *
 * gap=0: a uniform row-gap spread a single turn's traces and reply apart, so related lines read as
 * disjointed blocks (Chi, 2026-07-24). The shell instead groups a turn tightly and drops one spacer
 * before each new your-line, so the breathing room lands BETWEEN turns, not inside one.
 */
import type { ReactNode, Ref } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";

export function Scrollback({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef?: Ref<ScrollBoxRenderable>;
}): ReactNode {
  return (
    <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0}>
      <scrollbox
        ref={scrollRef}
        id="kit-scrollback"
        height="100%"
        scrollY
        stickyScroll
        stickyStart="bottom"
        verticalScrollbarOptions={{ visible: false }}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        gap={0}
      >
        {children}
      </scrollbox>
    </box>
  );
}
