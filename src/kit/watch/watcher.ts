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

/**
 * The polling loop, kept separate from the differ it drives.
 *
 * Its whole value is three details that are easy to get subtly wrong. `running` skips a tick rather
 * than stacking overlapping reads. `closed` is re-checked AFTER the await, so a stopped watcher
 * cannot deliver one last change into a torn-down view. A throw is swallowed, so a half-written file
 * costs one tick instead of the watcher. The snapshot advances even on an empty diff, which is what
 * stops one change being reported on every tick forever.
 */
function watchPolling<Snapshot, Change>({
  initial,
  read,
  diff,
  onChange,
  intervalMs,
  schedule = scheduleInterval,
}: {
  initial: Snapshot;
  read: () => Promise<Snapshot>;
  diff: (before: Snapshot, after: Snapshot) => Change | null;
  onChange: (after: Snapshot, change: Change) => void;
  intervalMs: number;
  schedule?: WatchScheduler;
}): () => void {
  let previous = initial;
  let running = false;
  let closed = false;
  const poll = async (): Promise<void> => {
    if (running || closed) return;
    running = true;
    try {
      const after = await read();
      if (closed) return;
      const change = diff(previous, after);
      previous = after;
      if (change) onChange(after, change);
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
  return watchPolling<readonly EntitySummary[], StudioChange>({
    initial: [...initial],
    read: list,
    diff: diffStudio,
    onChange: (_after, change) => onChange(change),
    intervalMs,
    schedule,
  });
}

