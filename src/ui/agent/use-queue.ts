/**
 * What you typed while the agent was still answering.
 *
 * THE COMPOSER USED TO GO DEAD for the length of a turn, so a thought that arrived mid-answer had
 * nowhere to go but your short-term memory. It is now always typeable, and a send during a turn
 * joins a queue that drains the moment the turn settles.
 *
 * KIT'S OWN QUEUE, imported rather than rewritten. The terminal has had this since before the
 * window existed - bounded, FIFO, refusing an empty line - and a second implementation would drift
 * the first time either side changed its mind about the bound.
 *
 * IT SURVIVES A RELOAD, because the dev server reloads this page whenever the source changes and a
 * queued message is something somebody typed and has not seen answered yet. Cleared with the
 * transcript, for the same reason the session id is: a new conversation must not inherit the last
 * one's unsent thoughts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appendQueued, dequeueQueued } from "../../kit/render/primitives/composer/queue";
import { QUEUE_KEY } from "../_shared/window-memory";

export interface QueueRoom {
  readonly items: readonly string[];
  /** Queue one. False when it was empty or the queue is full, which the caller reports. */
  add: (text: string) => boolean;
  /** Take the oldest, for the drain that runs when a turn settles. */
  take: () => string | null;
  /** Drop one by index: the "no, forget it" on a queued row. */
  drop: (at: number) => void;
  /** Pull one out to send right now, removing it from the queue. */
  claim: (at: number) => string | null;
}

/**
 * The queue's behaviour around a running turn: draining it, and the two things a waiting row offers.
 *
 * HERE RATHER THAN IN THE CHAT HOOK because it is one concept - what happens to a message that had
 * to wait - and because the chat hook is at its line cap for the ordinary reason that the turn
 * runner is what belongs there.
 */
export function useQueueDrain(input: {
  readonly queue: QueueRoom;
  readonly busy: boolean;
  /** A held question parks the loop; draining into it would answer the wrong thing. */
  readonly blocked: boolean;
  /** Read through refs, so the drain does not rebuild every time the sender does. */
  readonly send: React.RefObject<(text: string, brief?: string) => Promise<void>>;
  readonly brief: React.RefObject<string | undefined>;
  readonly stop: () => void;
}): {
  readonly queued: readonly string[];
  readonly dropQueued: (at: number) => void;
  readonly sendQueuedNow: (at: number) => void;
} {
  const { queue, busy, blocked, send, brief, stop } = input;

  /**
   * WATCHING `busy` RATHER THAN CALLING FROM A `finally`. The lock is claimed in the sender's
   * synchronous prologue, so this cannot double-send: by the time the effect could run again, busy
   * is true.
   */
  useEffect(() => {
    if (busy || blocked || queue.items.length === 0) return;
    const next = queue.take();
    if (next !== null) void send.current(next, brief.current);
  }, [busy, blocked, queue, send, brief]);

  return {
    queued: queue.items,
    dropQueued: queue.drop,
    sendQueuedNow: useCallback((at: number) => {
      const held = queue.claim(at);
      // Stop what is running, or "send now" would mean "send after this one" - which is what the
      // row was already doing.
      if (held !== null) { stop(); void send.current(held, brief.current); }
    }, [queue, stop, send, brief]),
  };
}

const read = (): string[] => {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Unreadable storage is an empty queue, never a thrown render.
    return [];
  }
};

export function useQueue(): QueueRoom {
  const [items, setItems] = useState<string[]>(read);
  /** The queue as it is RIGHT NOW, for a drain that runs from inside an async turn. */
  const current = useRef<string[]>(items);

  const replace = useCallback((next: string[]): void => {
    current.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* unavailable */ }
  }, [items]);

  const add = useCallback((text: string): boolean => {
    const next = appendQueued(current.current, text);
    if (next.accepted) replace(next.queue);
    return next.accepted;
  }, [replace]);

  const take = useCallback((): string | null => {
    const next = dequeueQueued(current.current);
    replace(next.queue);
    return next.item;
  }, [replace]);

  const drop = useCallback((at: number): void => {
    replace(current.current.filter((_, i) => i !== at));
  }, [replace]);

  const claim = useCallback((at: number): string | null => {
    const held = current.current[at] ?? null;
    if (held !== null) replace(current.current.filter((_, i) => i !== at));
    return held;
  }, [replace]);

  /**
   * ONE OBJECT PER CHANGE, not per render. The drain effect and the sender both depend on this, and
   * a fresh identity every render would re-run the drain continuously and rebuild the sender in the
   * middle of streaming turns.
   */
  return useMemo(
    () => ({ items, add, take, drop, claim }),
    [items, add, take, drop, claim],
  );
}
