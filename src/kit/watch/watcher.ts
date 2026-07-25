/** Debounced polling shell for process-local, read-only studio change watching. */
import type { EntitySummary } from "../bridge";
import { diffStudio, type StudioChange } from "./watch-core";

export type WatchScheduler = (
  poll: () => Promise<void>,
  intervalMs: number,
) => () => void;

export type StudioWatchSource = (
  onChange: (change: StudioChange) => void,
) => () => void;

const scheduleInterval: WatchScheduler = (poll, intervalMs) => {
  const timer = setInterval(() => void poll(), intervalMs);
  return () => clearInterval(timer);
};

export function watchStudio({
  initial,
  list,
  onChange,
  intervalMs = 1200,
  schedule = scheduleInterval,
}: {
  initial: readonly EntitySummary[];
  list: () => Promise<EntitySummary[]>;
  onChange: (change: StudioChange) => void;
  intervalMs?: number;
  schedule?: WatchScheduler;
}): () => void {
  let previous = [...initial];
  let running = false;
  let closed = false;
  const poll = async (): Promise<void> => {
    if (running || closed) return;
    running = true;
    try {
      const after = await list();
      if (closed) return;
      const change = diffStudio(previous, after);
      previous = [...after];
      if (change) onChange(change);
    } catch {
      // A half-written or temporarily unreadable studio is ignored until the next bounded poll.
    } finally {
      running = false;
    }
  };
  const unschedule = schedule(poll, intervalMs);
  return () => {
    closed = true;
    unschedule();
  };
}
