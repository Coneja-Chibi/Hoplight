/**
 * Versioned value-only protocol for the Lua sandbox worker boundary (ADR-009).
 *
 * Only JSON-like primitives, arrays, and plain records cross the wire. No functions, DOM handles,
 * ports other than the Worker channel, proxies, object URLs, paths, API tokens, or app objects.
 * Every received message is runtime-validated before use; fail closed.
 *
 * Callers apply assertWireWithinBudget before encoding.
 */

import type { LuaResourceReason } from "./limits";
import type { RisuStateWire } from "./risu-state";

/** Protocol version; bump only with a coordinated parent/worker change. */
export const SANDBOX_PROTOCOL_VERSION = 1 as const;

/** Keys that must never appear on any protocol message (token isolation). */
const FORBIDDEN_KEYS = new Set([
  "token",
  "authorization",
  "cookie",
  "cookies",
  "password",
  "secret",
  "vaude-session",
  "vaudeSession",
  "x-hoplight-token",
  "xHoplightToken",
  "sessionToken",
  "apiToken",
  "bearer",
]);

const RUN_KEYS = new Set([
  "v",
  "type",
  "runId",
  "code",
  "state",
  "memoryMaxBytes",
  "timeoutMs",
  "withPrelude",
  "stateBudget",
]);

const RESULT_KEYS = new Set([
  "v",
  "type",
  "runId",
  "result",
  "chatVars",
  "log",
  "state",
]);

const ERROR_KEYS = new Set([
  "v",
  "type",
  "runId",
  "reason",
  "limit",
  "message",
  "chatVars",
  "log",
  "state",
]);

const CANCEL_KEYS = new Set(["v", "type", "runId"]);

export type SandboxRunResultWire =
  | { ok: true; value: unknown }
  | {
      ok: false;
      reason: "timeout" | "error" | "resource";
      limit?: LuaResourceReason;
      message: string;
    };

/** Parent -> worker: execute one script. */
export interface SandboxRunRequest {
  v: typeof SANDBOX_PROTOCOL_VERSION;
  type: "run";
  runId: number;
  code: string;
  state: RisuStateWire;
  memoryMaxBytes: number;
  timeoutMs: number;
  withPrelude: boolean;
  /** Optional partial budget overrides (already clamped by resolveLuaRunLimits). */
  stateBudget?: Record<string, number>;
}

/** Parent -> worker: cooperative cancel (host still terminates the worker). */
export interface SandboxCancelRequest {
  v: typeof SANDBOX_PROTOCOL_VERSION;
  type: "cancel";
  runId: number;
}

export type SandboxRequest = SandboxRunRequest | SandboxCancelRequest;

/** Worker -> parent: successful protocol result (Lua may still have failed). */
export interface SandboxResultResponse {
  v: typeof SANDBOX_PROTOCOL_VERSION;
  type: "result";
  runId: number;
  result: SandboxRunResultWire;
  chatVars: Record<string, string>;
  log: string[];
  state: RisuStateWire;
}

/** Worker -> parent: protocol/resource failure before or instead of a Lua result. */
export interface SandboxErrorResponse {
  v: typeof SANDBOX_PROTOCOL_VERSION;
  type: "error";
  runId: number;
  reason: "timeout" | "error" | "resource" | "protocol";
  limit?: LuaResourceReason;
  message: string;
  chatVars: Record<string, string>;
  log: string[];
  state: RisuStateWire;
}

export type SandboxResponse = SandboxResultResponse | SandboxErrorResponse;

export class SandboxProtocolError extends Error {
  constructor(detail: string) {
    super(`sandbox-protocol: ${detail}`);
    this.name = "SandboxProtocolError";
  }
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;

const assertNoForbiddenKeys = (obj: Record<string, unknown>, path: string): void => {
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(k) || k === "__proto__" || k === "constructor" || k === "prototype") {
      throw new SandboxProtocolError(`forbidden key at ${path}: ${k}`);
    }
  }
};

const assertAllowlistKeys = (
  obj: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void => {
  assertNoForbiddenKeys(obj, path);
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) throw new SandboxProtocolError(`unexpected key at ${path}: ${k}`);
  }
};

/**
 * JSON-like value check: primitives, arrays, plain objects only.
 * Rejects functions, symbols, bigint, undefined in nested values, and non-plain prototypes.
 */
export function assertJsonLike(value: unknown, path = "root", depth = 0): void {
  if (depth > 32) throw new SandboxProtocolError(`too deep at ${path}`);
  if (value === null) return;
  const t = typeof value;
  if (t === "string" || t === "boolean") return;
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new SandboxProtocolError(`non-finite number at ${path}`);
    return;
  }
  if (t === "function" || t === "symbol" || t === "bigint" || t === "undefined") {
    throw new SandboxProtocolError(`non-json type ${t} at ${path}`);
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) assertJsonLike(value[i], `${path}[${i}]`, depth + 1);
    return;
  }
  if (!isPlainObject(value)) {
    throw new SandboxProtocolError(`non-plain object at ${path}`);
  }
  assertNoForbiddenKeys(value, path);
  for (const [k, v] of Object.entries(value)) {
    assertJsonLike(v, `${path}.${k}`, depth + 1);
  }
}

const parseFiniteInt = (v: unknown, name: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v) || v < 0) {
    throw new SandboxProtocolError(`${name} must be a non-negative integer`);
  }
  return v;
};

const parseStringRecord = (v: unknown, path: string): Record<string, string> => {
  if (v === undefined) return {};
  if (!isPlainObject(v)) throw new SandboxProtocolError(`${path} must be a plain object`);
  assertNoForbiddenKeys(v, path);
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") throw new SandboxProtocolError(`${path}.${k} must be a string`);
    out[k] = val;
  }
  return out;
};

const parseStateWire = (v: unknown): RisuStateWire => {
  if (v === undefined) return {};
  if (!isPlainObject(v)) throw new SandboxProtocolError("state must be a plain object");
  assertNoForbiddenKeys(v, "state");
  const allowed = new Set(["chatVars", "chat", "meta", "log"]);
  for (const k of Object.keys(v)) {
    if (!allowed.has(k)) throw new SandboxProtocolError(`unexpected state key: ${k}`);
  }
  assertJsonLike(v, "state");
  return v as RisuStateWire;
};

const parseRunResult = (v: unknown): SandboxRunResultWire => {
  if (!isPlainObject(v)) throw new SandboxProtocolError("result must be a plain object");
  assertNoForbiddenKeys(v, "result");
  if (v.ok === true) {
    if ("value" in v) assertJsonLike(v.value, "result.value");
    return { ok: true, value: v.value };
  }
  if (v.ok === false) {
    const reason = v.reason;
    if (reason !== "timeout" && reason !== "error" && reason !== "resource") {
      throw new SandboxProtocolError("result.reason invalid");
    }
    if (typeof v.message !== "string") throw new SandboxProtocolError("result.message must be a string");
    const out: SandboxRunResultWire = {
      ok: false,
      reason,
      message: v.message,
    };
    if (v.limit !== undefined) {
      if (typeof v.limit !== "string") throw new SandboxProtocolError("result.limit must be a string");
      out.limit = v.limit as LuaResourceReason;
    }
    return out;
  }
  throw new SandboxProtocolError("result.ok must be boolean");
};

/** Build a validated run request (parent side). Throws SandboxProtocolError on bad inputs. */
export function encodeRunRequest(args: {
  runId: number;
  code: string;
  state: RisuStateWire;
  memoryMaxBytes: number;
  timeoutMs: number;
  withPrelude: boolean;
  stateBudget?: Record<string, number>;
}): SandboxRunRequest {
  if (typeof args.code !== "string") throw new SandboxProtocolError("code must be a string");
  const msg: SandboxRunRequest = {
    v: SANDBOX_PROTOCOL_VERSION,
    type: "run",
    runId: parseFiniteInt(args.runId, "runId"),
    code: args.code,
    state: parseStateWire(args.state),
    memoryMaxBytes: parseFiniteInt(args.memoryMaxBytes, "memoryMaxBytes"),
    timeoutMs: parseFiniteInt(args.timeoutMs, "timeoutMs"),
    withPrelude: args.withPrelude === true,
  };
  if (args.stateBudget !== undefined) {
    if (!isPlainObject(args.stateBudget)) throw new SandboxProtocolError("stateBudget must be plain");
    assertNoForbiddenKeys(args.stateBudget, "stateBudget");
    for (const [k, val] of Object.entries(args.stateBudget)) {
      if (typeof val !== "number" || !Number.isFinite(val)) {
        throw new SandboxProtocolError(`stateBudget.${k} must be finite number`);
      }
    }
    msg.stateBudget = { ...args.stateBudget };
  }
  assertJsonLike(msg);
  return msg;
}

/** Parse a worker-bound request. Fail closed on any schema violation. */
export function parseRunRequest(raw: unknown): SandboxRunRequest {
  if (!isPlainObject(raw)) throw new SandboxProtocolError("request must be a plain object");
  assertAllowlistKeys(raw, RUN_KEYS, "request");
  if (raw.v !== SANDBOX_PROTOCOL_VERSION) {
    throw new SandboxProtocolError(`unsupported version: ${String(raw.v)}`);
  }
  if (raw.type !== "run") throw new SandboxProtocolError(`expected type run, got ${String(raw.type)}`);
  if (typeof raw.code !== "string") throw new SandboxProtocolError("code must be a string");
  if (typeof raw.withPrelude !== "boolean") throw new SandboxProtocolError("withPrelude must be boolean");
  const msg: SandboxRunRequest = {
    v: SANDBOX_PROTOCOL_VERSION,
    type: "run",
    runId: parseFiniteInt(raw.runId, "runId"),
    code: raw.code,
    state: parseStateWire(raw.state),
    memoryMaxBytes: parseFiniteInt(raw.memoryMaxBytes, "memoryMaxBytes"),
    timeoutMs: parseFiniteInt(raw.timeoutMs, "timeoutMs"),
    withPrelude: raw.withPrelude,
  };
  if (raw.stateBudget !== undefined) {
    if (!isPlainObject(raw.stateBudget)) throw new SandboxProtocolError("stateBudget must be plain");
    assertNoForbiddenKeys(raw.stateBudget, "stateBudget");
    const budget: Record<string, number> = {};
    for (const [k, val] of Object.entries(raw.stateBudget)) {
      if (typeof val !== "number" || !Number.isFinite(val)) {
        throw new SandboxProtocolError(`stateBudget.${k} must be finite number`);
      }
      budget[k] = val;
    }
    msg.stateBudget = budget;
  }
  return msg;
}

/** Optional cancel parse (host still terminates). */
export function parseCancelRequest(raw: unknown): SandboxCancelRequest {
  if (!isPlainObject(raw)) throw new SandboxProtocolError("cancel must be a plain object");
  assertAllowlistKeys(raw, CANCEL_KEYS, "cancel");
  if (raw.v !== SANDBOX_PROTOCOL_VERSION) throw new SandboxProtocolError("unsupported version");
  if (raw.type !== "cancel") throw new SandboxProtocolError("expected type cancel");
  return {
    v: SANDBOX_PROTOCOL_VERSION,
    type: "cancel",
    runId: parseFiniteInt(raw.runId, "runId"),
  };
}

export function encodeResultResponse(args: {
  runId: number;
  result: SandboxRunResultWire;
  chatVars: Record<string, string>;
  log: string[];
  state: RisuStateWire;
}): SandboxResultResponse {
  const msg: SandboxResultResponse = {
    v: SANDBOX_PROTOCOL_VERSION,
    type: "result",
    runId: parseFiniteInt(args.runId, "runId"),
    result: args.result,
    chatVars: parseStringRecord(args.chatVars, "chatVars"),
    log: Array.isArray(args.log) ? args.log.map((l) => (typeof l === "string" ? l : String(l))) : [],
    state: parseStateWire(args.state),
  };
  assertJsonLike(msg);
  return msg;
}

export function encodeErrorResponse(args: {
  runId: number;
  reason: SandboxErrorResponse["reason"];
  message: string;
  limit?: LuaResourceReason;
  chatVars?: Record<string, string>;
  log?: string[];
  state?: RisuStateWire;
}): SandboxErrorResponse {
  const msg: SandboxErrorResponse = {
    v: SANDBOX_PROTOCOL_VERSION,
    type: "error",
    runId: parseFiniteInt(args.runId, "runId"),
    reason: args.reason,
    message: typeof args.message === "string" ? args.message : String(args.message),
    chatVars: parseStringRecord(args.chatVars ?? {}, "chatVars"),
    log: Array.isArray(args.log) ? args.log.map((l) => (typeof l === "string" ? l : String(l))) : [],
    state: parseStateWire(args.state ?? {}),
  };
  if (args.limit !== undefined) msg.limit = args.limit;
  assertJsonLike(msg);
  return msg;
}

/** Parse a parent-bound response. Fail closed. */
export function parseRunResponse(raw: unknown): SandboxResponse {
  if (!isPlainObject(raw)) throw new SandboxProtocolError("response must be a plain object");
  assertNoForbiddenKeys(raw, "response");
  if (raw.v !== SANDBOX_PROTOCOL_VERSION) {
    throw new SandboxProtocolError(`unsupported version: ${String(raw.v)}`);
  }
  if (raw.type === "result") {
    assertAllowlistKeys(raw, RESULT_KEYS, "response");
    if (!Array.isArray(raw.log)) throw new SandboxProtocolError("log must be an array");
    return {
      v: SANDBOX_PROTOCOL_VERSION,
      type: "result",
      runId: parseFiniteInt(raw.runId, "runId"),
      result: parseRunResult(raw.result),
      chatVars: parseStringRecord(raw.chatVars, "chatVars"),
      log: raw.log.map((l) => (typeof l === "string" ? l : String(l))),
      state: parseStateWire(raw.state),
    };
  }
  if (raw.type === "error") {
    assertAllowlistKeys(raw, ERROR_KEYS, "response");
    const reason = raw.reason;
    if (
      reason !== "timeout" &&
      reason !== "error" &&
      reason !== "resource" &&
      reason !== "protocol"
    ) {
      throw new SandboxProtocolError("error.reason invalid");
    }
    if (typeof raw.message !== "string") throw new SandboxProtocolError("message must be a string");
    if (!Array.isArray(raw.log)) throw new SandboxProtocolError("log must be an array");
    const out: SandboxErrorResponse = {
      v: SANDBOX_PROTOCOL_VERSION,
      type: "error",
      runId: parseFiniteInt(raw.runId, "runId"),
      reason,
      message: raw.message,
      chatVars: parseStringRecord(raw.chatVars, "chatVars"),
      log: raw.log.map((l) => (typeof l === "string" ? l : String(l))),
      state: parseStateWire(raw.state),
    };
    if (raw.limit !== undefined) {
      if (typeof raw.limit !== "string") throw new SandboxProtocolError("limit must be a string");
      out.limit = raw.limit as LuaResourceReason;
    }
    return out;
  }
  throw new SandboxProtocolError(`unknown response type: ${String(raw.type)}`);
}

/** True when a plain object (or nested) contains a forbidden credential-ish key. */
export function messageContainsForbiddenKeys(value: unknown, depth = 0): boolean {
  if (depth > 32 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((v) => messageContainsForbiddenKeys(v, depth + 1));
  }
  for (const k of Object.keys(value as object)) {
    if (FORBIDDEN_KEYS.has(k) || k === "__proto__") return true;
    if (messageContainsForbiddenKeys((value as Record<string, unknown>)[k], depth + 1)) return true;
  }
  return false;
}
