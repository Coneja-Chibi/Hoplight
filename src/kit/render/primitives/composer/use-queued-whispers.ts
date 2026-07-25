/** React state seam around the pure bounded whisper queue. */
import { useRef, useState } from "react";
import { appendQueued, dequeueQueued } from "./queue";

export function useQueuedWhispers(): {
  items: readonly string[];
  append: (item: string) => boolean;
  shift: () => string | null;
} {
  const current = useRef<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const replace = (next: string[]): void => {
    current.current = next;
    setItems(next);
  };
  return {
    items,
    append(item) {
      const next = appendQueued(current.current, item);
      if (next.accepted) replace(next.queue);
      return next.accepted;
    },
    shift() {
      const next = dequeueQueued(current.current);
      replace(next.queue);
      return next.item;
    },
  };
}
