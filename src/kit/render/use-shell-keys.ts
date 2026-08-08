/**
 * The shell's own keys: interrupt, fold, search, and the scroll stops.
 *
 * These are the bindings that belong to NOBODY ELSE on screen. Anything the composer, the rail, the
 * search card or the gate owns is handled where it is drawn; this hook stands down entirely whenever
 * one of those is up, which is why `active` is a single guard in shell-keys-core rather than a
 * condition sprinkled through the cases.
 */
import type { MutableRefObject } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { consumesKey, shellKeyAction } from "./shell-keys-core";
import { toggleTrace, type TurnView } from "./turn-events";

export interface ShellKeyDeps {
  /** True when the shell itself owns the keyboard: session view, nothing else layered over it. */
  active: boolean;
  /**
   * The running turn, AS A REF.
   *
   * `startTurn` assigns this synchronously and only then asks React to re-render, and the settle path
   * clears it before it clears busy. A value read at render time is therefore wrong in both windows:
   * an escape pressed the instant a turn began would find null and interrupt nothing.
   */
  running: MutableRefObject<{ controller: AbortController } | null>;
  setTurn: (update: (previous: TurnView) => TurnView) => void;
  openSearch: () => void;
  scroll: {
    snapToBottom: () => void;
    snapToTop: () => void;
    pageBy: (direction: 1 | -1) => void;
  };
}

export function useShellKeys({ active, running, setTurn, openSearch, scroll }: ShellKeyDeps): void {
  useKeyboard((event: KeyEvent) => {
    const action = shellKeyAction(event, active);
    if (!action) return;
    // An escape with nothing running is not ours: it belongs to whatever wants to close next.
    if (action === "interrupt" && !running.current) return;
    if (consumesKey(action)) event.preventDefault();
    switch (action) {
      case "interrupt":
        running.current!.controller.abort();
        return;
      // ctrl+o toggles the latest folded thought, backstage cluster, or settled long reply.
      case "fold":
        setTurn((prev) => toggleTrace(prev));
        return;
      // ctrl+f drops the script-view transcript search over the conversation
      case "search":
        openSearch();
        return;
      case "scroll-bottom":
        scroll.snapToBottom();
        return;
      case "scroll-top":
        scroll.snapToTop();
        return;
      case "page-up":
        scroll.pageBy(-1);
        return;
      case "page-down":
        scroll.pageBy(1);
    }
  });
}
