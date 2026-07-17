/**
 * Worker entry: runs ONE untrusted Risu card script (Lua) off the host thread with the full Test Bench
 * host API + json + optional prelude. Killable via worker.terminate() from run-in-worker.ts.
 *
 * Capabilities cannot cross the worker boundary as functions, so state crosses instead.
 * Timeout/memory/state budgets are re-clamped here so a hostile postMessage cannot raise ceilings.
 * Wire format: versioned value-only protocol (protocol.ts / ADR-009). Never accepts an API token.
 */
import { runLua, type LuaRunResult } from "./run";
import { createRisuApi } from "./risu-api";
import { jsonGlobals } from "./lua-json";
import { RISU_TESTBENCH_PRELUDE } from "./risu-prelude";
import {
  assertSourceWithinBudget,
  assertStateWithinBudget,
  assertWireWithinBudget,
  isLuaResourceLimitError,
  resolveLuaRunLimits,
} from "./limits";
import {
  encodeErrorResponse,
  encodeResultResponse,
  parseRunRequest,
  SandboxProtocolError,
  type SandboxResponse,
} from "./protocol";
import { stateFromWire, stateToWire, type RisuStateWire } from "./risu-state";

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<unknown>) => void) | null;
  postMessage: (message: SandboxResponse) => void;
};

const toSandboxResult = (result: LuaRunResult): import("./protocol").SandboxRunResultWire => {
  if (result.ok) return { ok: true, value: result.value };
  return {
    ok: false,
    reason: result.reason,
    message: result.message,
    ...(result.limit !== undefined ? { limit: result.limit } : {}),
  };
};

ctx.onmessage = (e: MessageEvent<unknown>): void => {
  let runId = 0;
  let wire: RisuStateWire = {};

  try {
    const req = parseRunRequest(e.data);
    runId = req.runId;
    wire = req.state;

    const limits = resolveLuaRunLimits({
      timeoutMs: req.timeoutMs,
      memoryMaxBytes: req.memoryMaxBytes,
      state: req.stateBudget,
    });

    const fail = (result: LuaRunResult, state: RisuStateWire, log: string[] = []): void => {
      ctx.postMessage(
        encodeResultResponse({
          runId,
          result: toSandboxResult(result),
          chatVars: state.chatVars ?? {},
          log,
          state,
        }),
      );
    };

    try {
      assertSourceWithinBudget(req.code, limits.maxSourceBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reason = isLuaResourceLimitError(err) ? err.reason : "source-size";
      fail(
        { ok: false, reason: "resource", limit: reason, message: msg },
        wire,
      );
      return;
    }

    const state = stateFromWire(wire);
    try {
      assertStateWithinBudget(state, limits.state);
      assertWireWithinBudget(stateToWire(state), limits.maxRequestBytes, "request");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reason = isLuaResourceLimitError(err) ? err.reason : "host-state";
      fail(
        { ok: false, reason: "resource", limit: reason, message: msg },
        stateToWire(state),
      );
      return;
    }

    let capabilities: Record<string, (...args: unknown[]) => unknown>;
    try {
      capabilities = { ...jsonGlobals(), ...createRisuApi(state, limits.state).globals };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const reason = isLuaResourceLimitError(err) ? err.reason : "host-state";
      fail(
        { ok: false, reason: "resource", limit: reason, message: msg },
        stateToWire(state),
      );
      return;
    }

    const body = req.withPrelude ? `${RISU_TESTBENCH_PRELUDE}\n${req.code}` : req.code;
    void runLua(req.code.length === 0 ? "return nil" : body, {
      capabilities,
      memoryMaxBytes: limits.memoryMaxBytes,
      // Same authoritative deadline as the parent kill switch (no 120s leash above release max).
      timeoutMs: limits.timeoutMs,
    }).then((result) => {
      const out = stateToWire(state);
      try {
        assertStateWithinBudget(state, limits.state);
        assertWireWithinBudget(out, limits.maxResponseBytes, "response");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const reason = isLuaResourceLimitError(err) ? err.reason : "wire-size";
        fail(
          { ok: false, reason: "resource", limit: reason, message: msg },
          wire,
        );
        return;
      }
      ctx.postMessage(
        encodeResultResponse({
          runId,
          result: toSandboxResult(result),
          chatVars: state.chatVars,
          log: state.log,
          state: out,
        }),
      );
    });
  } catch (err) {
    const msg =
      err instanceof SandboxProtocolError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    ctx.postMessage(
      encodeErrorResponse({
        runId,
        reason: "protocol",
        message: msg,
        chatVars: wire.chatVars ?? {},
        log: [],
        state: wire,
      }),
    );
  }
};
