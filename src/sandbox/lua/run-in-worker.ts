/**
 * Run one untrusted Risu card (Lua) in a Worker with a hard wall-clock deadline - the REAL kill switch.
 * The card gets its host API (get/setChatVar + json) built inside the worker over the chatVars passed in;
 * the mutated chatVars + log come back with the result. If the card returns first, its result passes
 * through; if the deadline hits first (an infinite loop or wasm hang the in-VM timeout can't stop), the
 * worker is TERMINATED and a timeout result is returned. The worker is always torn down, win or lose.
 *
 * This is the Phase 1 backstop. The cross-origin iframe (an OS-level second boundary) is a later phase;
 * here the card runs in a same-origin worker, which is the availability/kill layer.
 */
import type { LuaRunResult } from "./run";

export interface SandboxOptions {
  /** wall-clock deadline in ms; past it the worker is terminated and a timeout result returned. */
  timeoutMs?: number;
  memoryMaxBytes?: number;
  /** starting variable state; the card reads/writes it via get/setChatVar. */
  chatVars?: Record<string, string>;
}

/** A completed sandboxed run: the Lua result, plus the variable state + log the card produced. */
export interface SandboxResult {
  result: LuaRunResult;
  chatVars: Record<string, string>;
  log: string[];
}

const DEFAULT_DEADLINE_MS = 1000;

/** Run untrusted Lua source in a terminable worker with a hard deadline. Never hangs, never throws. */
export function runLuaSandboxed(code: string, opts: SandboxOptions = {}): Promise<SandboxResult> {
  const deadline = opts.timeoutMs ?? DEFAULT_DEADLINE_MS;
  const startingVars = opts.chatVars ?? {};
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" });
    let settled = false;
    const finish = (result: SandboxResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(
      () =>
        finish({
          result: { ok: false, reason: "timeout", message: `sandbox deadline ${deadline}ms exceeded` },
          chatVars: startingVars,
          log: [],
        }),
      deadline,
    );
    worker.addEventListener("message", (e: MessageEvent) => finish(e.data as SandboxResult));
    worker.addEventListener("error", (e: ErrorEvent) =>
      finish({ result: { ok: false, reason: "error", message: e.message }, chatVars: startingVars, log: [] }),
    );
    worker.postMessage({ code, chatVars: startingVars, memoryMaxBytes: opts.memoryMaxBytes });
  });
}
