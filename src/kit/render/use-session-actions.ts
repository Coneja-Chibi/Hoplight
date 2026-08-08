/**
 * Session lifecycle for the shell: open, rename, remove, start fresh, rewind, fork, export.
 *
 * Split out of app.tsx because it is one concept with one owner - the stored conversation - and every
 * one of these refuses while a turn is in flight. Keeping that refusal in one place is the point: a
 * rewind that lands mid-turn would write a session the running turn is about to append to.
 */
import type { MutableRefObject } from "react";
import { join } from "node:path";
import type { ModelMessage } from "../providers/provider";
import { configDir } from "../providers/config";
import {
  buildTurn as _buildTurn,
  emptySession,
  forkFrom,
  renameSession,
  rewindTo,
  type Session as MemorySession,
} from "../sessions/session-model";
import { toHistory } from "../sessions/projection";
import { messagesToLines } from "../sessions/render/replay";
import type { SessionStore } from "../sessions/store";
import { formatTranscript } from "../sessions/transcript";
import type { SessionActions } from "../sessions/session-actions";
import type { RenderLine, TurnView } from "./turn-events";

/** What the shell lends this: its refs, its setters, and the one line-adder. */
export interface SessionActionsDeps {
  store: MutableRefObject<SessionStore | null>;
  memory: MutableRefObject<MemorySession | null>;
  history: MutableRefObject<ModelMessage[]>;
  activeTurn: MutableRefObject<{ controller: AbortController } | null>;
  makeSessionId: () => string;
  now: () => number;
  add: (line: RenderLine) => void;
  setTurn: (update: (previous: TurnView) => TurnView) => void;
  setGreeted: (greeted: boolean) => void;
  setRewinding: (rewinding: boolean) => void;
  setSearching: (searching: boolean) => void;
  setView: (view: "session" | "settings" | "sessions" | "help" | "tools") => void;
  /**
   * Put the rail back on the preset this session was working on, or shut it when there was none.
   *
   * Resume restored the conversation and left the rail closed, because the rail was never part of
   * the record. A session is what you were working ON as well as what was said.
   */
  restoreRail?: (presetId: string | null) => void;
}

export interface ShellSessions {
  /** Make one stored session the live one and redraw the transcript from it. */
  selectMemory: (next: MemorySession) => void;
  actions: SessionActions;
}

export function buildSessionActions(deps: SessionActionsDeps): ShellSessions {
  const { store, memory, history, activeTurn, makeSessionId, now, add } = deps;

  const selectMemory = (next: MemorySession): void => {
    memory.current = next;
    history.current = toHistory(next);
    /**
     * A RESUMED session is not a new one, and the greeting is only true of a new one.
     *
     * The opening banner rendered unconditionally - it merely stopped ANIMATING once a line existed -
     * so resuming a conversation put "Hey, welcome in. I'm really glad you're here" above a
     * transcript already in progress, and the screen read as a fresh start with somebody else's
     * history under it. A session with turns has been greeted already.
     */
    deps.setGreeted(next.turns.length > 0);
    deps.setTurn((prev) => ({
      ...prev,
      lines: messagesToLines(history.current),
      live: { phase: "idle" },
      tools: null,
      toolsSeen: false,
    }));
    deps.setRewinding(false);
    deps.setSearching(false);
    deps.setView("session");
    // Last, so it lands on a transcript that has already been redrawn rather than one mid-swap.
    deps.restoreRail?.(next.rail);
  };

  const actions: SessionActions = {
    list: () => store.current!.list(),
    async open(id) {
      if (activeTurn.current) return;
      const next = await store.current!.read(id);
      if (!next) {
        add({ role: "error", text: "That session is missing or unreadable." });
        return;
      }
      selectMemory(next);
    },
    async rename(id, title) {
      if (activeTurn.current) return;
      const found = await store.current!.read(id);
      if (!found) return add({ role: "error", text: "That session is missing or unreadable." });
      const next = renameSession(found, title, now());
      await store.current!.write(next);
      if (memory.current?.id === id) memory.current = next;
    },
    async remove(id) {
      if (activeTurn.current) return;
      await store.current!.remove(id);
      if (memory.current?.id === id) selectMemory(emptySession(makeSessionId(), now()));
    },
    fresh() {
      if (!activeTurn.current) selectMemory(emptySession(makeSessionId(), now()));
    },
    current: () => memory.current!,
    async rewind(turnNumber) {
      if (activeTurn.current) return;
      const next = rewindTo(memory.current!, turnNumber, now());
      await store.current!.write(next);
      selectMemory(next);
    },
    async fork(turnNumber) {
      if (activeTurn.current) return;
      const next = forkFrom(memory.current!, turnNumber, makeSessionId(), now());
      await store.current!.write(next);
      selectMemory(next);
    },
    async exportTranscript(format) {
      if (activeTurn.current) {
        add({ role: "error", text: "Wait for the current turn before exporting." });
        return;
      }
      const transcript = formatTranscript(memory.current!, format);
      const path = await store.current!.writeExport(
        join(configDir(), "exports"),
        transcript.filename,
        transcript.body,
      );
      add({ role: "say", text: `Exported session to ${path}` });
    },
    openPlaybill: () => deps.setView("sessions"),
    openRail: () => deps.setRewinding(true),
  };

  return { selectMemory, actions };
}
