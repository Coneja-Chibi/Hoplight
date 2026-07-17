/**
 * Run a card's module triggerlua in the sealed wasmoon room with Risu host shims + Test Bench prelude.
 * Prefers a killable Worker when available; falls back to in-process run (tests without Worker quirks).
 * Does not reach the network, DOM, or filesystem.
 *
 * Defaults and ceilings come from RELEASE_LUA_LIMITS (resolveLuaRunLimits). Callers cannot raise
 * timeout/memory above the release max (no more silent 60s/256MiB overrides).
 */
import { createRisuApi, type RisuState } from "./risu-api";
import { jsonGlobals } from "./lua-json";
import {
  assertSourceWithinBudget,
  assertStateWithinBudget,
  isLuaResourceLimitError,
  resolveLuaRunLimits,
  type LuaRunLimitOverrides,
  type LuaResourceReason,
} from "./limits";
import { RISU_TESTBENCH_PRELUDE } from "./risu-prelude";
import { runLua, type LuaRunResult } from "./run";
import { runLuaSandboxed } from "./run-in-worker";
import { stateFromWire } from "./risu-state";

export interface ModuleLuaRun {
  result: LuaRunResult;
  state: RisuState;
}

export interface RunModuleLuaOptions {
  /** Wall-clock kill deadline (ms). Clamped to release max. */
  timeoutMs?: number;
  /** VM memory ceiling in bytes. Clamped to release max. */
  memoryMaxBytes?: number;
  /** Optional tail after the module source (probe without mutating stored text). */
  tail?: string;
  /** When false, skip the Test Bench Lua prelude. Default true. */
  withPrelude?: boolean;
  /**
   * When true (default in browser / when Worker exists), use the killable worker.
   * Tests may set false to stay on the main thread for simpler stacks.
   */
  useWorker?: boolean;
  /** Optional smaller state budget for adversarial tests. */
  stateBudget?: LuaRunLimitOverrides["state"];
}

const canUseWorker = (): boolean =>
  typeof Worker !== "undefined" && typeof URL !== "undefined";

const resourceResult = (err: unknown): LuaRunResult => {
  if (isLuaResourceLimitError(err)) {
    return { ok: false, reason: "resource", limit: err.reason, message: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, reason: "resource", limit: "host-state" as LuaResourceReason, message: msg };
};

/**
 * Execute module Lua source with host shims + optional prelude bound to `state` (mutated in place).
 * Source only - never bytecode.
 */
export async function runModuleLua(
  code: string,
  state: RisuState,
  opts: RunModuleLuaOptions = {},
): Promise<ModuleLuaRun> {
  const limits = resolveLuaRunLimits({
    timeoutMs: opts.timeoutMs,
    memoryMaxBytes: opts.memoryMaxBytes,
    state: opts.stateBudget,
  });

  const withPrelude = opts.withPrelude !== false;
  const parts: string[] = [];
  // Worker injects prelude itself when withPrelude; main-thread path prepends here.
  const useWorker = opts.useWorker ?? canUseWorker();
  if (!useWorker && withPrelude) parts.push(RISU_TESTBENCH_PRELUDE);
  parts.push(code);
  if (opts.tail) parts.push(opts.tail);
  const body = parts.join("\n");

  try {
    assertSourceWithinBudget(body, limits.maxSourceBytes);
    assertStateWithinBudget(state, limits.state);
  } catch (err) {
    return { result: resourceResult(err), state };
  }

  if (useWorker) {
    const boxed = await runLuaSandboxed(body, {
      timeoutMs: limits.timeoutMs,
      memoryMaxBytes: limits.memoryMaxBytes,
      state,
      withPrelude,
      stateBudget: limits.state,
    });
    const next = stateFromWire(boxed.state);
    // Mutate caller's state in place so callers keep the same object reference.
    // Only apply worker state when the run did not fail a resource gate pre-mutation.
    if (boxed.result.ok || boxed.result.reason !== "resource") {
      state.chatVars = next.chatVars;
      state.log = next.log;
      state.chat = next.chat;
      state.meta = next.meta;
    }
    return { result: boxed.result, state };
  }

  let capabilities: Record<string, (...args: unknown[]) => unknown>;
  try {
    capabilities = { ...jsonGlobals(), ...createRisuApi(state, limits.state).globals };
  } catch (err) {
    return { result: resourceResult(err), state };
  }

  const result = await runLua(body, {
    capabilities,
    timeoutMs: limits.timeoutMs,
    memoryMaxBytes: limits.memoryMaxBytes,
  });
  return { result, state };
}
