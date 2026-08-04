/** Debounced polling shell for process-local, read-only studio change watching. */
import type { EntitySummary } from "../bridge";
import { diffStudio, type StudioChange } from "./watch-core";
import { diffOutline, outlineOf, type OutlineDiff, type OutlineRow } from "../../core/preset/outline";
import type { PresetBody } from "../../entities/preset";

export type WatchScheduler = (
  poll: () => Promise<void>,
  intervalMs: number,
) => () => void;

export type StudioWatchSource = (
  onChange: (change: StudioChange) => void,
) => () => void;

/** The rail's source: a preset's rows now, plus what changed to get here. */
export type PresetWatchSource = (
  onChange: (rows: readonly OutlineRow[], diff: OutlineDiff) => void,
) => () => void;

const scheduleInterval: WatchScheduler = (poll, intervalMs) => {
  const timer = setInterval(() => void poll(), intervalMs);
  return () => clearInterval(timer);
};

/**
 * The polling loop itself, shared by both watchers.
 *
 * Extracted when the second watcher arrived, because the loop's whole value is three details that
 * are easy to get subtly wrong twice. `running` skips a tick rather than stacking overlapping reads.
 * `closed` is re-checked AFTER the await, so a stopped watcher cannot deliver one last change into a
 * torn-down view. A throw is swallowed, so a half-written file costs one tick instead of the watcher.
 * The snapshot advances even when the diff is empty, which is what stops one change being reported
 * on every tick forever.
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

/**
 * Follow one preset's block order.
 *
 * FASTER THAN THE STUDIO WATCHER, deliberately. That one reports somebody editing a file in another
 * window, where a second of lag is invisible. This is a rail beside a conversation showing what Kit
 * is doing right now, and a move that lands a beat after the sentence describing it reads as two
 * events rather than one.
 *
 * A preset that goes missing stops the rail rather than emptying it. Throwing keeps the previous
 * snapshot and skips the tick, which is the loop's existing tolerance; returning an empty outline
 * would report 150 removals for a file that is merely being written to.
 */
export function watchPreset({
  initial,
  read,
  onChange,
  intervalMs = 400,
  schedule = scheduleInterval,
}: {
  initial: readonly OutlineRow[];
  read: () => Promise<PresetBody | undefined>;
  onChange: (rows: readonly OutlineRow[], diff: OutlineDiff) => void;
  intervalMs?: number;
  schedule?: WatchScheduler;
}): () => void {
  return watchPolling<readonly OutlineRow[], OutlineDiff>({
    initial: [...initial],
    read: async () => {
      const body = await read();
      if (!body) throw new Error("preset unavailable");
      return outlineOf(body);
    },
    diff: diffOutline,
    onChange,
    intervalMs,
    schedule,
  });
}
