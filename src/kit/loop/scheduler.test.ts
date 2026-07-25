/**
 * Scheduler contract coverage: reads may overlap, while any mutating batch stays ordered.
 */
import { expect, test } from "bun:test";
import type { ModelToolCall } from "../providers/provider";
import type { ToolEffect } from "../tools/tool";
import { scheduleToolCalls } from "./scheduler";

const call = (id: string, name = id): ModelToolCall => ({ id, name, args: {} });

test("read-only batches overlap but return observations in provider order", async () => {
  const releases = new Map<string, () => void>();
  const started: string[] = [];
  const pending = [call("first"), call("second")];
  const scheduled = scheduleToolCalls(pending, {
    effectFor: () => "read",
    onStart: (item) => started.push(item.id),
    dispatch: async (item) => {
      await new Promise<void>((resolve) => releases.set(item.id, resolve));
      return { summary: item.id, output: item.id };
    },
  });

  await Bun.sleep(0);
  expect(started).toEqual(["first", "second"]);
  releases.get("second")?.();
  releases.get("first")?.();
  expect((await scheduled).map((entry) => entry.call.id)).toEqual(["first", "second"]);
});

test("a batch containing a draft runs every call serially in declared order", async () => {
  const trace: string[] = [];
  const effects = new Map<string, ToolEffect>([
    ["read", "read"],
    ["draft", "draft"],
  ]);
  await scheduleToolCalls([call("read"), call("draft")], {
    effectFor: (item) => effects.get(item.name),
    dispatch: async (item) => {
      trace.push(`start:${item.id}`);
      await Bun.sleep(0);
      trace.push(`end:${item.id}`);
      return { summary: item.id, output: item.id };
    },
  });
  expect(trace).toEqual(["start:read", "end:read", "start:draft", "end:draft"]);
});

test("unknown effects fail toward serialization", async () => {
  let active = 0;
  let peak = 0;
  await scheduleToolCalls([call("a"), call("b")], {
    effectFor: () => undefined,
    dispatch: async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await Bun.sleep(0);
      active -= 1;
      return { summary: item.id, output: item.id };
    },
  });
  expect(peak).toBe(1);
});
