/** Pure bounded FIFO operations for follow-up whispers submitted during an active turn. */

export const MAX_QUEUED = 20;

export interface QueueAppend {
  accepted: boolean;
  queue: string[];
}

export interface QueueDequeue {
  item: string | null;
  queue: string[];
}

export function appendQueued(queue: readonly string[], item: string): QueueAppend {
  if (!item.trim() || queue.length >= MAX_QUEUED) {
    return { accepted: false, queue: [...queue] };
  }
  return { accepted: true, queue: [...queue, item] };
}

export function dequeueQueued(queue: readonly string[]): QueueDequeue {
  if (queue.length === 0) return { item: null, queue: [] };
  return { item: queue[0] ?? null, queue: queue.slice(1) };
}
