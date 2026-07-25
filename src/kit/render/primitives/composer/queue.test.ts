/** Proves queued whispers stay ordered and bounded. */
import { expect, test } from "bun:test";
import { appendQueued, dequeueQueued, MAX_QUEUED } from "./queue";

test("appends and drains whispers oldest first", () => {
  let queue: string[] = [];
  queue = appendQueued(queue, "second").queue;
  queue = appendQueued(queue, "third").queue;
  const first = dequeueQueued(queue);
  expect(first.item).toBe("second");
  expect(first.queue).toEqual(["third"]);
});

test("rejects beyond the cap without evicting accepted whispers", () => {
  const full = Array.from({ length: MAX_QUEUED }, (_, index) => `message ${index}`);
  expect(appendQueued(full, "overflow")).toEqual({ accepted: false, queue: full });
});
