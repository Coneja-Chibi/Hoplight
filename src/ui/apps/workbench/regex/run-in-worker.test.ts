/** Regression coverage for the regex worker's hard termination boundary. */
import { expect, test } from "bun:test";
import { runRegexSandboxed } from "./run-in-worker";

test("terminates an unresponsive worker at the hard deadline", async () => {
  let terminated = false;
  const worker = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    postMessage: () => undefined,
    terminate: () => { terminated = true; },
  } as unknown as Worker;
  const result = await runRegexSandboxed("sample", [], {
    phase: "output",
    hardTimeoutMs: 5,
    workerFactory: () => worker,
  });
  expect(result).toMatchObject({ ok: false, reason: "timeout" });
  expect(terminated).toBe(true);
});

test("returns an error result when the browser refuses to create a worker", async () => {
  const result = await runRegexSandboxed("sample", [], {
    phase: "output",
    workerFactory: () => { throw new Error("blocked by policy"); },
  });
  expect(result).toMatchObject({ ok: false, reason: "error", error: expect.stringContaining("blocked by policy") });
});

test("terminates a worker when posting its request fails", async () => {
  let terminated = false;
  const worker = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    postMessage: () => { throw new Error("clone failed"); },
    terminate: () => { terminated = true; },
  } as unknown as Worker;
  const result = await runRegexSandboxed("sample", [], {
    phase: "output",
    workerFactory: () => worker,
  });
  expect(result).toMatchObject({ ok: false, reason: "error", error: expect.stringContaining("clone failed") });
  expect(terminated).toBe(true);
});
