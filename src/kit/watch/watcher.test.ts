/** Proves the polling shell emits one coalesced change and tears down cleanly. */
import { expect, test } from "bun:test";
import type { EntitySummary } from "../bridge";
import { watchStudio, type WatchScheduler } from "./watcher";

test("polls from an injected baseline and stops through the scheduler handle", async () => {
  const before: EntitySummary[] = [{ id: "basil", kind: "character", name: "Basil" }];
  const after: EntitySummary[] = [...before, { id: "mira", kind: "character", name: "Mira" }];
  const scheduled: { poll?: () => Promise<void> } = {};
  let stopped = false;
  const schedule: WatchScheduler = (run) => {
    scheduled.poll = run;
    return () => {
      stopped = true;
    };
  };
  const changes: string[][] = [];
  const stop = watchStudio({
    initial: before,
    list: async () => after,
    onChange: (change) => changes.push(change.added.map((item) => item.name)),
    schedule,
  });
  if (!scheduled.poll) throw new Error("watch poll was not scheduled");
  await scheduled.poll();
  expect(changes).toEqual([["Mira"]]);
  stop();
  expect(stopped).toBe(true);
});
