/** Proves doctor checks run independently, concurrently, and time out without hiding other results. */
import { expect, test } from "bun:test";
import type { DoctorCheck, DoctorContext } from "./check";
import { runDoctor } from "./run";

const context: DoctorContext = {
  pieces: async () => [],
  provider: async () => null,
  vault: async () => ({ backend: "test", providers: 0, active: false }),
  version: "1.0.0",
  runtime: "test",
};

test("settles successful, failed, and timed-out checks in source order", async () => {
  const checks: DoctorCheck[] = [
    {
      id: "ok",
      label: "First",
      async run() {
        return { status: "ok", detail: "ready" };
      },
    },
    {
      id: "fail",
      label: "Second",
      async run() {
        throw new Error("broken");
      },
    },
    {
      id: "slow",
      label: "Third",
      async run() {
        await new Promise(() => {});
        return { status: "ok", detail: "never" };
      },
    },
  ];

  expect(await runDoctor(checks, context, { timeoutMs: 10 })).toEqual([
    { id: "ok", label: "First", status: "ok", detail: "ready" },
    { id: "fail", label: "Second", status: "fail", detail: "broken" },
    { id: "slow", label: "Third", status: "warn", detail: "timed out" },
  ]);
});
