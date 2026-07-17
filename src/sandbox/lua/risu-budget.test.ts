/**
 * Host-state mutation quotas: failed ops leave prior state unchanged; tiny budgets surface as
 * resource failures through the real Lua path.
 */
import { describe, expect, test } from "bun:test";
import { createRisuApi, emptyRisuState, type RisuState } from "./risu-api";
import { LuaResourceLimitError, RELEASE_LUA_LIMITS, type RisuStateBudget } from "./limits";
import { runLua } from "./run";
import { cloneRisuState } from "./risu-state";

const tinyBudget = (patch: Partial<RisuStateBudget> = {}): RisuStateBudget => ({
  ...RELEASE_LUA_LIMITS.state,
  maxHostStateBytes: 4096,
  maxChatVarCount: 4,
  maxChatVarKeyBytes: 16,
  maxChatVarValueBytes: 32,
  maxLogCount: 3,
  maxLogEntryBytes: 24,
  maxChatMessageCount: 3,
  maxChatRoleBytes: 16,
  maxChatMessageBytes: 40,
  maxMetaFieldBytes: 32,
  maxFullChatJsonBytes: 200,
  ...patch,
});

const snap = (s: RisuState): string => JSON.stringify(cloneRisuState(s));

describe("createRisuApi budgets: atomic rejection", () => {
  test("oversized setChatVar leaves prior vars unchanged", () => {
    const state = emptyRisuState();
    state.chatVars.mood = "calm";
    const before = snap(state);
    const { globals } = createRisuApi(state, tinyBudget());
    expect(() => globals.setChatVar!("mood", "x".repeat(100))).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
  });

  test("log count cap is atomic", () => {
    const state = emptyRisuState();
    const { globals } = createRisuApi(state, tinyBudget({ maxLogCount: 2 }));
    globals.log!("a");
    globals.log!("b");
    const before = snap(state);
    expect(() => globals.log!("c")).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
  });

  test("chat message count cap rejects addChat without partial push", () => {
    const state = emptyRisuState();
    const { globals } = createRisuApi(state, tinyBudget({ maxChatMessageCount: 1 }));
    globals.addChat!("char", "one");
    const before = snap(state);
    expect(() => globals.addChat!("user", "two")).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
    expect(state.chat).toHaveLength(1);
  });

  test("setFullChat rejects oversized raw input before parse", () => {
    const state = emptyRisuState();
    state.chat = [{ role: "char", data: "keep" }];
    const before = snap(state);
    const { globals } = createRisuApi(state, tinyBudget({ maxFullChatJsonBytes: 20 }));
    const huge = JSON.stringify([{ role: "char", data: "x".repeat(200) }]);
    expect(() => globals.setFullChat!(huge)).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
  });

  test("setFullChat rejects over-count array without swapping", () => {
    const state = emptyRisuState();
    state.chat = [{ role: "char", data: "keep" }];
    const before = snap(state);
    const { globals } = createRisuApi(state, tinyBudget({ maxChatMessageCount: 2 }));
    const payload = JSON.stringify([
      { role: "char", data: "a" },
      { role: "user", data: "b" },
      { role: "char", data: "c" },
    ]);
    expect(() => globals.setFullChat!(payload)).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
  });

  test("replacement frees budget for a same-size value", () => {
    const state = emptyRisuState();
    const budget = tinyBudget({ maxChatVarValueBytes: 10, maxHostStateBytes: 64 });
    const { globals } = createRisuApi(state, budget);
    globals.setChatVar!("k", "1234567890"); // exactly 10
    globals.setChatVar!("k", "abcdefghij"); // replace same size
    expect(state.chatVars.k).toBe("abcdefghij");
  });

  test("meta field oversize is rejected", () => {
    const state = emptyRisuState();
    state.meta.name = "ok";
    const before = snap(state);
    const { globals } = createRisuApi(state, tinyBudget({ maxMetaFieldBytes: 4 }));
    expect(() => globals.setName!("toolong")).toThrow(LuaResourceLimitError);
    expect(snap(state)).toBe(before);
  });
});

describe("createRisuApi budgets: through real Lua", () => {
  test("resource failure surfaces as reason resource with chat-var limit", async () => {
    const state = emptyRisuState();
    const { globals } = createRisuApi(state, tinyBudget({ maxChatVarValueBytes: 5 }));
    const res = await runLua('setChatVar("k", "too-long-value")', { capabilities: globals });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Prefer typed resource; if wasmoon wraps, message still carries the tag.
      if (res.reason === "resource") {
        expect(res.limit).toBe("chat-var");
      } else {
        expect(res.message).toContain("[resource:chat-var]");
      }
    }
    expect(state.chatVars.k).toBeUndefined();
  });

  test("aggregate many legal entries eventually hits host-state", async () => {
    const state = emptyRisuState();
    const budget = tinyBudget({
      maxChatVarCount: 50,
      maxChatVarValueBytes: 20,
      maxHostStateBytes: 80,
    });
    const { globals } = createRisuApi(state, budget);
    const res = await runLua(
      `
      for i = 1, 40 do
        setChatVar("k" .. i, "abcdefghij")
      end
      return "ok"
      `,
      { capabilities: globals },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      if (res.reason === "resource") {
        expect(res.limit === "host-state" || res.limit === "chat-var").toBe(true);
      } else {
        expect(res.message).toMatch(/\[resource:(host-state|chat-var)\]/);
      }
    }
  });
});
