/**
 * Run untrusted Lua in a Worker with a hard wall-clock deadline - the REAL kill switch. If the card
 * returns first, its Result passes through; if the deadline hits first (an infinite loop or a wasm hang
 * the in-VM timeout can't stop), the worker is TERMINATED and a timeout Result is returned. The worker is
 * always torn down, win or lose, so a run leaves no thread behind.
 *
 * This is the Phase 1 backstop. The narrow host bridge (capabilities marshalled across the boundary by
 * value) and the cross-origin iframe are later phases; here the worker runs pure hardened Lua.
 */
import type { LuaRunResult } from "./run";

export interface SandboxOptions {
  /** wall-clock deadline in ms; past it the worker is terminated and a timeout Result returned. */
  timeoutMs?: number;
  memoryMaxBytes?: number;
}

const DEFAULT_DEADLINE_MS = 1000;

/** Run untrusted Lua source in a terminable worker with a hard deadline. Never hangs, never throws. */
export function runLuaSandboxed(code: string, opts: SandboxOptions = {}): Promise<LuaRunResult> {
  const deadline = opts.timeoutMs ?? DEFAULT_DEADLINE_MS;
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url).href, { type: "module" });
    let settled = false;
    const finish = (result: LuaRunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, reason: "timeout", message: `sandbox deadline ${deadline}ms exceeded` }),
      deadline,
    );
    worker.addEventListener("message", (e: MessageEvent) => finish(e.data as LuaRunResult));
    worker.addEventListener("error", (e: ErrorEvent) => finish({ ok: false, reason: "error", message: e.message }));
    worker.postMessage({ code, memoryMaxBytes: opts.memoryMaxBytes });
  });
}
