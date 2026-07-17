/**
 * Budget contract: UTF-8 inclusive accounting, clamp ceilings, and boundary cases.
 */
import { describe, expect, test } from "bun:test";
import {
  assertSourceWithinBudget,
  assertStateWithinBudget,
  LuaResourceLimitError,
  measureHostStateBytes,
  RELEASE_LUA_LIMITS,
  resolveLuaRunLimits,
  utf8Bytes,
} from "./limits";
import { emptyRisuState } from "./risu-state";

describe("utf8Bytes", () => {
  test("counts ASCII as one byte each", () => {
    expect(utf8Bytes("abc")).toBe(3);
  });

  test("counts multibyte Unicode by UTF-8, not code units", () => {
    // "é" is U+00E9 -> 2 bytes; emoji is 4 bytes
    expect(utf8Bytes("é")).toBe(2);
    expect(utf8Bytes("🙂")).toBe(4);
    expect("🙂".length).toBe(2); // JS code units differ
  });
});

describe("resolveLuaRunLimits", () => {
  test("defaults match release policy", () => {
    const l = resolveLuaRunLimits();
    expect(l.timeoutMs).toBe(RELEASE_LUA_LIMITS.timeoutMs);
    expect(l.memoryMaxBytes).toBe(RELEASE_LUA_LIMITS.memoryMaxBytes);
  });

  test("clamps oversized timeout/memory to release max", () => {
    const l = resolveLuaRunLimits({ timeoutMs: 60_000, memoryMaxBytes: 256 * 1024 * 1024 });
    expect(l.timeoutMs).toBe(RELEASE_LUA_LIMITS.timeoutMs);
    expect(l.memoryMaxBytes).toBe(RELEASE_LUA_LIMITS.memoryMaxBytes);
  });

  test("allows smaller injected budgets for tests", () => {
    const l = resolveLuaRunLimits({
      timeoutMs: 200,
      state: { maxChatVarCount: 2, maxHostStateBytes: 64 },
    });
    expect(l.timeoutMs).toBe(200);
    expect(l.state.maxChatVarCount).toBe(2);
    expect(l.state.maxHostStateBytes).toBe(64);
  });
});

describe("assertSourceWithinBudget", () => {
  test("accepts exactly at the cap", () => {
    expect(() => assertSourceWithinBudget("a".repeat(10), 10)).not.toThrow();
  });

  test("rejects one byte over", () => {
    expect(() => assertSourceWithinBudget("a".repeat(11), 10)).toThrow(LuaResourceLimitError);
  });

  test("counts UTF-8 for multibyte source", () => {
    // three smileys = 12 bytes
    expect(() => assertSourceWithinBudget("🙂🙂🙂", 11)).toThrow(LuaResourceLimitError);
    expect(() => assertSourceWithinBudget("🙂🙂🙂", 12)).not.toThrow();
  });
});

describe("assertStateWithinBudget", () => {
  test("accepts empty state", () => {
    expect(() => assertStateWithinBudget(emptyRisuState(), RELEASE_LUA_LIMITS.state)).not.toThrow();
  });

  test("rejects over-limit chat var value", () => {
    const state = emptyRisuState();
    state.chatVars.k = "x".repeat(20);
    const budget = { ...RELEASE_LUA_LIMITS.state, maxChatVarValueBytes: 10 };
    expect(() => assertStateWithinBudget(state, budget)).toThrow(LuaResourceLimitError);
  });

  test("rejects aggregate host-state overage", () => {
    const state = emptyRisuState();
    state.chatVars.a = "hello";
    const total = measureHostStateBytes(state);
    const budget = { ...RELEASE_LUA_LIMITS.state, maxHostStateBytes: total - 1 };
    expect(() => assertStateWithinBudget(state, budget)).toThrow(LuaResourceLimitError);
  });
});
