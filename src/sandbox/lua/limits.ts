/**
 * Typed resource budgets for the Risu Lua Test Bench. Lua heap ceilings (Wasmoon) do not cover
 * host-side JS arrays, maps, JSON strings, or worker message copies, so every mutation and wire
 * boundary must enforce these quotas before allocating attacker-sized state.
 *
 * Limits are inclusive: a value of exactly maxBytes is accepted; maxBytes + 1 is rejected.
 * UTF-8 byte counts use TextEncoder (not JS string length / code units).
 */

import type { RisuCardMeta, RisuChatMessage, RisuState, RisuStateWire } from "./risu-state";

/** Machine-readable resource failure categories (Workshop + worker serialize this shape). */
export type LuaResourceReason =
  | "timeout"
  | "lua-memory"
  | "host-state"
  | "message-count"
  | "wire-size"
  | "source-size"
  | "chat-var"
  | "log"
  | "meta";

/** Stable resource-limit error; capability throws and run paths map this to a bounded result. */
export class LuaResourceLimitError extends Error {
  readonly reason: LuaResourceReason;

  constructor(reason: LuaResourceReason, detail: string) {
    super(`[resource:${reason}] ${detail}`);
    this.name = "LuaResourceLimitError";
    this.reason = reason;
  }
}

/** Per-field and aggregate caps on host-side RisuState. */
export interface RisuStateBudget {
  /** Total UTF-8 bytes across vars + log + chat + meta (inclusive). */
  maxHostStateBytes: number;
  maxChatVarCount: number;
  maxChatVarKeyBytes: number;
  maxChatVarValueBytes: number;
  maxLogCount: number;
  maxLogEntryBytes: number;
  maxChatMessageCount: number;
  maxChatRoleBytes: number;
  maxChatMessageBytes: number;
  maxMetaFieldBytes: number;
  /** Cap on getFullChat / setFullChat JSON UTF-8 size (inclusive). */
  maxFullChatJsonBytes: number;
}

/** Wall-clock, Lua heap, source, and postMessage wire budgets for one run. */
export interface LuaRunLimits {
  /** Host wall-clock deadline (ms). Also used as the in-VM functionTimeout. */
  timeoutMs: number;
  /** Wasmoon setMemoryMax ceiling (bytes). */
  memoryMaxBytes: number;
  maxSourceBytes: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  state: RisuStateBudget;
}

/**
 * Release defaults: short enough that a hostile card cannot freeze the Workshop, large enough for
 * ordinary Test Bench scripts. Callers may request lower values for adversarial tests; higher
 * values are clamped to these ceilings (never trusted upward).
 */
export const RELEASE_LUA_LIMITS: LuaRunLimits = {
  timeoutMs: 5_000,
  memoryMaxBytes: 64 * 1024 * 1024,
  maxSourceBytes: 2 * 1024 * 1024,
  maxRequestBytes: 4 * 1024 * 1024,
  maxResponseBytes: 4 * 1024 * 1024,
  state: {
    maxHostStateBytes: 2 * 1024 * 1024,
    maxChatVarCount: 512,
    maxChatVarKeyBytes: 256,
    maxChatVarValueBytes: 16_384,
    maxLogCount: 256,
    maxLogEntryBytes: 4_096,
    maxChatMessageCount: 500,
    maxChatRoleBytes: 64,
    maxChatMessageBytes: 32_768,
    maxMetaFieldBytes: 65_536,
    maxFullChatJsonBytes: 1 * 1024 * 1024,
  },
};

const encoder = new TextEncoder();

/** UTF-8 byte length of a string. */
export const utf8Bytes = (s: string): number => encoder.encode(s).byteLength;

export const META_KEYS: readonly (keyof RisuCardMeta)[] = [
  "name",
  "description",
  "firstMessage",
  "personaName",
  "personaDescription",
  "authorsNote",
  "backgroundEmbedding",
] as const;

export function measureChatVarsBytes(vars: Record<string, string>): number {
  let n = 0;
  for (const [k, v] of Object.entries(vars)) n += utf8Bytes(k) + utf8Bytes(v);
  return n;
}

export function measureChatBytes(chat: readonly RisuChatMessage[]): number {
  let n = 0;
  for (const m of chat) n += utf8Bytes(m.role) + utf8Bytes(m.data);
  return n;
}

export function measureMetaBytes(meta: RisuCardMeta): number {
  let n = 0;
  for (const k of META_KEYS) n += utf8Bytes(meta[k] ?? "");
  return n;
}

export function measureLogBytes(log: readonly string[]): number {
  let n = 0;
  for (const line of log) n += utf8Bytes(line);
  return n;
}

/** Aggregate host-state UTF-8 footprint (vars + log + chat + meta). */
export function measureHostStateBytes(state: RisuState): number {
  return (
    measureChatVarsBytes(state.chatVars) +
    measureLogBytes(state.log) +
    measureChatBytes(state.chat) +
    measureMetaBytes(state.meta)
  );
}

export function measureWireBytes(wire: RisuStateWire): number {
  // Structural JSON estimate is fine for a hard wire cap; use JSON.stringify size.
  return utf8Bytes(JSON.stringify(wire));
}

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.trunc(value)));

export interface LuaRunLimitOverrides {
  timeoutMs?: number;
  memoryMaxBytes?: number;
  maxSourceBytes?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  state?: Partial<RisuStateBudget>;
}

/**
 * Merge caller overrides under the release ceiling. Never allows a timeout or memory above release
 * max; missing fields take release defaults. Smaller injected budgets (tests) pass through.
 */
export function resolveLuaRunLimits(
  overrides: LuaRunLimitOverrides = {},
  ceiling: LuaRunLimits = RELEASE_LUA_LIMITS,
): LuaRunLimits {
  const stateCeiling = ceiling.state;
  const stateIn = overrides.state ?? {};
  const state: RisuStateBudget = {
    maxHostStateBytes: clampInt(
      stateIn.maxHostStateBytes ?? stateCeiling.maxHostStateBytes,
      1,
      stateCeiling.maxHostStateBytes,
    ),
    maxChatVarCount: clampInt(
      stateIn.maxChatVarCount ?? stateCeiling.maxChatVarCount,
      1,
      stateCeiling.maxChatVarCount,
    ),
    maxChatVarKeyBytes: clampInt(
      stateIn.maxChatVarKeyBytes ?? stateCeiling.maxChatVarKeyBytes,
      1,
      stateCeiling.maxChatVarKeyBytes,
    ),
    maxChatVarValueBytes: clampInt(
      stateIn.maxChatVarValueBytes ?? stateCeiling.maxChatVarValueBytes,
      1,
      stateCeiling.maxChatVarValueBytes,
    ),
    maxLogCount: clampInt(stateIn.maxLogCount ?? stateCeiling.maxLogCount, 1, stateCeiling.maxLogCount),
    maxLogEntryBytes: clampInt(
      stateIn.maxLogEntryBytes ?? stateCeiling.maxLogEntryBytes,
      1,
      stateCeiling.maxLogEntryBytes,
    ),
    maxChatMessageCount: clampInt(
      stateIn.maxChatMessageCount ?? stateCeiling.maxChatMessageCount,
      1,
      stateCeiling.maxChatMessageCount,
    ),
    maxChatRoleBytes: clampInt(
      stateIn.maxChatRoleBytes ?? stateCeiling.maxChatRoleBytes,
      1,
      stateCeiling.maxChatRoleBytes,
    ),
    maxChatMessageBytes: clampInt(
      stateIn.maxChatMessageBytes ?? stateCeiling.maxChatMessageBytes,
      1,
      stateCeiling.maxChatMessageBytes,
    ),
    maxMetaFieldBytes: clampInt(
      stateIn.maxMetaFieldBytes ?? stateCeiling.maxMetaFieldBytes,
      1,
      stateCeiling.maxMetaFieldBytes,
    ),
    maxFullChatJsonBytes: clampInt(
      stateIn.maxFullChatJsonBytes ?? stateCeiling.maxFullChatJsonBytes,
      1,
      stateCeiling.maxFullChatJsonBytes,
    ),
  };

  return {
    timeoutMs: clampInt(overrides.timeoutMs ?? ceiling.timeoutMs, 1, ceiling.timeoutMs),
    memoryMaxBytes: clampInt(
      overrides.memoryMaxBytes ?? ceiling.memoryMaxBytes,
      64 * 1024,
      ceiling.memoryMaxBytes,
    ),
    maxSourceBytes: clampInt(
      overrides.maxSourceBytes ?? ceiling.maxSourceBytes,
      1,
      ceiling.maxSourceBytes,
    ),
    maxRequestBytes: clampInt(
      overrides.maxRequestBytes ?? ceiling.maxRequestBytes,
      1,
      ceiling.maxRequestBytes,
    ),
    maxResponseBytes: clampInt(
      overrides.maxResponseBytes ?? ceiling.maxResponseBytes,
      1,
      ceiling.maxResponseBytes,
    ),
    state,
  };
}

export function assertSourceWithinBudget(code: string, maxSourceBytes: number): void {
  const n = utf8Bytes(code);
  if (n > maxSourceBytes) {
    throw new LuaResourceLimitError(
      "source-size",
      `source ${n} bytes exceeds cap ${maxSourceBytes}`,
    );
  }
}

export function assertWireWithinBudget(
  wire: RisuStateWire,
  maxBytes: number,
  which: "request" | "response",
): void {
  const n = measureWireBytes(wire);
  if (n > maxBytes) {
    throw new LuaResourceLimitError(
      "wire-size",
      `${which} state ${n} bytes exceeds cap ${maxBytes}`,
    );
  }
}

/**
 * Validate seeded / returned host state against field, count, and aggregate caps.
 * Does not mutate; throws LuaResourceLimitError when over budget.
 */
export function assertStateWithinBudget(state: RisuState, budget: RisuStateBudget): void {
  const varKeys = Object.keys(state.chatVars);
  if (varKeys.length > budget.maxChatVarCount) {
    throw new LuaResourceLimitError(
      "chat-var",
      `chatVar count ${varKeys.length} exceeds cap ${budget.maxChatVarCount}`,
    );
  }
  for (const [k, v] of Object.entries(state.chatVars)) {
    if (utf8Bytes(k) > budget.maxChatVarKeyBytes) {
      throw new LuaResourceLimitError(
        "chat-var",
        `chatVar key ${utf8Bytes(k)} bytes exceeds cap ${budget.maxChatVarKeyBytes}`,
      );
    }
    if (utf8Bytes(v) > budget.maxChatVarValueBytes) {
      throw new LuaResourceLimitError(
        "chat-var",
        `chatVar value ${utf8Bytes(v)} bytes exceeds cap ${budget.maxChatVarValueBytes}`,
      );
    }
  }
  if (state.log.length > budget.maxLogCount) {
    throw new LuaResourceLimitError(
      "log",
      `log count ${state.log.length} exceeds cap ${budget.maxLogCount}`,
    );
  }
  for (const line of state.log) {
    if (utf8Bytes(line) > budget.maxLogEntryBytes) {
      throw new LuaResourceLimitError(
        "log",
        `log entry ${utf8Bytes(line)} bytes exceeds cap ${budget.maxLogEntryBytes}`,
      );
    }
  }
  if (state.chat.length > budget.maxChatMessageCount) {
    throw new LuaResourceLimitError(
      "message-count",
      `chat length ${state.chat.length} exceeds cap ${budget.maxChatMessageCount}`,
    );
  }
  for (const m of state.chat) {
    if (utf8Bytes(m.role) > budget.maxChatRoleBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat role ${utf8Bytes(m.role)} bytes exceeds cap ${budget.maxChatRoleBytes}`,
      );
    }
    if (utf8Bytes(m.data) > budget.maxChatMessageBytes) {
      throw new LuaResourceLimitError(
        "message-count",
        `chat message ${utf8Bytes(m.data)} bytes exceeds cap ${budget.maxChatMessageBytes}`,
      );
    }
  }
  for (const k of META_KEYS) {
    const v = state.meta[k] ?? "";
    if (utf8Bytes(v) > budget.maxMetaFieldBytes) {
      throw new LuaResourceLimitError(
        "meta",
        `meta.${k} ${utf8Bytes(v)} bytes exceeds cap ${budget.maxMetaFieldBytes}`,
      );
    }
  }
  const total = measureHostStateBytes(state);
  if (total > budget.maxHostStateBytes) {
    throw new LuaResourceLimitError(
      "host-state",
      `host state ${total} bytes exceeds cap ${budget.maxHostStateBytes}`,
    );
  }
}

/** Parse a resource-tagged error message (worker / wrapped throws). */
export function parseResourceLimitMessage(
  message: string,
): { reason: LuaResourceReason; detail: string } | null {
  const m = /^\[resource:([a-z-]+)\]\s*(.*)$/i.exec(message.trim());
  if (!m) return null;
  const reason = m[1]!.toLowerCase() as LuaResourceReason;
  return { reason, detail: m[2] ?? "" };
}

export function isLuaResourceLimitError(err: unknown): err is LuaResourceLimitError {
  return err instanceof LuaResourceLimitError;
}
