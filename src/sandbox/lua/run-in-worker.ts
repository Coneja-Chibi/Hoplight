/**
 * Run one untrusted Risu card (Lua) in a Worker with a hard wall-clock deadline - the REAL kill switch.
 * The card gets its host API + json + Test Bench prelude built inside the worker; full RisuState
 * (vars, chat, meta, log) comes back with the result. If the deadline hits first, the worker is TERMINATED.
 *
 * Browser: worker is preferably loaded from the sandbox origin (ADR-009 meta vaude-sandbox-origin).
 * Fallback: same-origin /sandbox/worker.js when the meta is absent (degraded; not claimed isolated).
 * Bun tests: local worker.ts.
 *
 * Wire: versioned value-only protocol (protocol.ts). The API token never enters messages.
 * Resource budgets: source and wire state are validated before postMessage; timeout/memory are clamped
 * to release ceilings so callers cannot request 60s/256MiB past the authoritative policy.
 */
// Do NOT import from ./run (wasmoon) - this module is pulled into the browser workbench bundle.
// Keep the result shape local so tree-shaking never drags the Lua engine into app chrome.
import {
  assertSourceWithinBudget,
  assertStateWithinBudget,
  assertWireWithinBudget,
  isLuaResourceLimitError,
  parseResourceLimitMessage,
  resolveLuaRunLimits,
  type LuaResourceReason,
  type RisuStateBudget,
} from "./limits";
import {
  encodeRunRequest,
  messageContainsForbiddenKeys,
  parseRunResponse,
  SandboxProtocolError,
} from "./protocol";
import { stateToWire, type RisuState, type RisuStateWire } from "./risu-state";

export type SandboxLuaResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "timeout" | "error" | "resource";
      limit?: LuaResourceReason;
      message: string;
    };

export interface SandboxOptions {
  /** wall-clock deadline in ms; clamped to release max; past it the worker is terminated. */
  timeoutMs?: number;
  /** Lua heap ceiling; clamped to release max. */
  memoryMaxBytes?: number;
  /** starting variable state (legacy). Prefer `state`. */
  chatVars?: Record<string, string>;
  /** full bench state (vars + chat + meta). */
  state?: RisuState;
  /** when true (default), prepend the Test Bench Lua prelude (listenEdit/getState/async). */
  withPrelude?: boolean;
  /** optional injected state budget overrides (tests); clamped under release. */
  stateBudget?: Partial<RisuStateBudget>;
}

/** A completed sandboxed run: the Lua result, plus the variable state + log the card produced. */
export interface SandboxResult {
  result: SandboxLuaResult;
  chatVars: Record<string, string>;
  log: string[];
  state: RisuStateWire;
}

const SANDBOX_ORIGIN_META = 'meta[name="vaude-sandbox-origin"]';

/** Read the sandbox origin injected by the UI server. Never reads the session token. */
export function readSandboxOrigin(doc: Document | undefined = typeof document !== "undefined" ? document : undefined): string | null {
  if (!doc) return null;
  const el = doc.querySelector(SANDBOX_ORIGIN_META);
  const t = el?.getAttribute("content")?.trim() ?? "";
  if (!t.startsWith("http://127.0.0.1:")) return null;
  return t.replace(/\/$/, "");
}

const workerHref = (): string => {
  // Browser UI: prefer distinct sandbox origin (ADR-009); else same-origin fallback.
  if (typeof globalThis !== "undefined" && typeof (globalThis as { document?: unknown }).document !== "undefined") {
    const origin = readSandboxOrigin();
    if (origin) return `${origin}/sandbox/worker.js`;
    return "/sandbox/worker.js";
  }
  // Bun tests: module-relative worker entry.
  return new URL("./worker.ts", import.meta.url).href;
};

let runSeq = 0;

const resourceResult = (
  err: unknown,
  startingVars: Record<string, string>,
  wire: RisuStateWire,
): SandboxResult => {
  if (isLuaResourceLimitError(err)) {
    return {
      result: { ok: false, reason: "resource", limit: err.reason, message: err.message },
      chatVars: startingVars,
      log: [],
      state: wire,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  const parsed = parseResourceLimitMessage(msg);
  return {
    result: {
      ok: false,
      reason: "resource",
      limit: parsed?.reason,
      message: msg,
    },
    chatVars: startingVars,
    log: [],
    state: wire,
  };
};

/** Run untrusted Lua source in a terminable worker with a hard deadline. Never hangs, never throws. */
export function runLuaSandboxed(code: string, opts: SandboxOptions = {}): Promise<SandboxResult> {
  const limits = resolveLuaRunLimits({
    timeoutMs: opts.timeoutMs,
    memoryMaxBytes: opts.memoryMaxBytes,
    state: opts.stateBudget,
  });
  const deadline = limits.timeoutMs;
  const wire: RisuStateWire = opts.state
    ? stateToWire(opts.state)
    : { chatVars: opts.chatVars ?? {} };
  const startingVars = { ...(wire.chatVars ?? {}) };

  try {
    assertSourceWithinBudget(code, limits.maxSourceBytes);
    if (opts.state) assertStateWithinBudget(opts.state, limits.state);
    assertWireWithinBudget(wire, limits.maxRequestBytes, "request");
  } catch (err) {
    return Promise.resolve(resourceResult(err, startingVars, wire));
  }

  const expectedRunId = ++runSeq;

  let requestMsg;
  try {
    requestMsg = encodeRunRequest({
      runId: expectedRunId,
      code,
      state: wire,
      memoryMaxBytes: limits.memoryMaxBytes,
      timeoutMs: limits.timeoutMs,
      withPrelude: opts.withPrelude !== false,
      stateBudget: limits.state as unknown as Record<string, number>,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Promise.resolve({
      result: { ok: false, reason: "error", message: msg },
      chatVars: startingVars,
      log: [],
      state: wire,
    });
  }

  // Defense: never ship a message that still carries credential-shaped keys.
  if (messageContainsForbiddenKeys(requestMsg)) {
    return Promise.resolve({
      result: { ok: false, reason: "error", message: "sandbox-protocol: refused to send forbidden keys" },
      chatVars: startingVars,
      log: [],
      state: wire,
    });
  }

  return new Promise((resolve) => {
    const worker = new Worker(workerHref(), { type: "module" });
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
          result: {
            ok: false,
            reason: "timeout",
            limit: "timeout",
            message: `sandbox deadline ${deadline}ms exceeded`,
          },
          chatVars: startingVars,
          log: [],
          state: wire,
        }),
      deadline,
    );
    worker.addEventListener("message", (e: MessageEvent) => {
      try {
        const data = parseRunResponse(e.data);
        if (data.runId !== expectedRunId) return; // stale / spoofed generation
        if (data.type === "error") {
          const reason =
            data.reason === "protocol"
              ? "error"
              : data.reason === "timeout"
                ? "timeout"
                : data.reason === "resource"
                  ? "resource"
                  : "error";
          finish({
            result: {
              ok: false,
              reason,
              limit: data.limit,
              message: data.message,
            },
            chatVars: data.chatVars,
            log: data.log,
            state: data.state,
          });
          return;
        }
        try {
          if (data.state) assertWireWithinBudget(data.state, limits.maxResponseBytes, "response");
        } catch (err) {
          finish(resourceResult(err, startingVars, wire));
          return;
        }
        finish({
          result: data.result,
          chatVars: data.chatVars,
          log: data.log,
          state: data.state,
        });
      } catch (err) {
        const msg =
          err instanceof SandboxProtocolError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err);
        finish({
          result: { ok: false, reason: "error", message: msg },
          chatVars: startingVars,
          log: [],
          state: wire,
        });
      }
    });
    worker.addEventListener("error", (e: ErrorEvent) =>
      finish({
        result: { ok: false, reason: "error", message: e.message || "worker error" },
        chatVars: startingVars,
        log: [],
        state: wire,
      }),
    );
    worker.postMessage(requestMsg);
  });
}
