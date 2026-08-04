/**
 * The shell's own keys: interrupt, fold, search, and the scroll stops.
 *
 * These are the bindings that belong to NOBODY ELSE on screen. Anything the composer, the rail, the
 * search card or the gate owns is handled where it is drawn; this hook stands down entirely whenever
 * one of those is up, which is the whole reason it is a guard clause at the top rather than a set of
 * conditions sprinkled through the cases.
 */
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { toggleTrace, type TurnView } from "./turn-events";

export interface ShellKeyDeps {
  /** True when the shell itself owns the keyboard: session view, nothing else layered over it. */
  active: boolean;
  /** The running turn, so escape can interrupt it. Null when nothing is in flight. */
  running: { controller: AbortController } | null;
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
    // While the search card is open it owns the keyboard (esc/enter/up/down); the shell stays out of
    // the way. Same for the gate, the rewind rail, and every screen that is not the session.
    if (!active) return;
    if (event.name === "escape" && running) {
      event.preventDefault();
      running.controller.abort();
      return;
    }
    // ctrl+o toggles the latest folded thought, backstage cluster, or settled long reply.
    if (event.ctrl && event.name === "o") {
      setTurn((prev) => toggleTrace(prev));
      return;
    }
    // ctrl+f drops the script-view transcript search over the conversation
    if (event.ctrl && event.name === "f") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.name === "end") {
      event.preventDefault();
      scroll.snapToBottom();
    } else if (event.name === "home") {
      event.preventDefault();
      scroll.snapToTop();
    } else if (event.name === "pageup") {
      event.preventDefault();
      scroll.pageBy(-1);
    } else if (event.name === "pagedown") {
      event.preventDefault();
      scroll.pageBy(1);
    }
  });
}
