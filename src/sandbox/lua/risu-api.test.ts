/**
 * Proof that the clean-room Risu host API behaves per the public contract when driven by real Lua through
 * the hardened engine: chat-var writes/reads round-trip, the getvar/setvar sugar aliases the same store,
 * log accumulates, args coerce defensively, and a name we never injected stays nil in the card's world
 * (deny-by-absence). We drive Lua via runLua so the test exercises the actual injection path, not the JS
 * functions in isolation.
 */
import { describe, expect, test } from "bun:test";
import { createRisuApi, type RisuState } from "./risu-api";
import { runLua } from "./run";

const freshState = (): RisuState => ({ chatVars: {}, log: [] });

describe("createRisuApi: card-facing shims over plain state", () => {
  test("setChatVar/getChatVar round-trip and log accumulate through real Lua", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    const code = `
      setChatVar("mood", "grumpy")
      log("set mood")
      return getChatVar("mood")
    `;
    const res = await runLua(code, { capabilities: globals });
    expect(res).toEqual({ ok: true, value: "grumpy" });
    expect(state.chatVars.mood).toBe("grumpy");
    expect(state.log).toEqual(["set mood"]);
  });

  test("getvar/setvar sugar aliases the same store as getChatVar/setChatVar", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    const code = `
      setvar("hp", "10")
      setChatVar("mp", "5")
      return getvar("hp") .. "/" .. getChatVar("mp")
    `;
    const res = await runLua(code, { capabilities: globals });
    expect(res).toEqual({ ok: true, value: "10/5" });
    expect(state.chatVars).toEqual({ hp: "10", mp: "5" });
  });

  test("coerces numbers to strings (Lua may pass a number, not a string)", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    const res = await runLua('setChatVar("gold", 42) return getChatVar("gold")', {
      capabilities: globals,
    });
    expect(res).toEqual({ ok: true, value: "42" });
    expect(state.chatVars.gold).toBe("42");
  });

  test("an unset var reads as empty string, not nil", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    const res = await runLua('return getChatVar("missing")', { capabilities: globals });
    expect(res).toEqual({ ok: true, value: "" });
  });

  test("state is mutated in place so the caller reads results after the run", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    await runLua('setChatVar("a", "1") log("done")', { capabilities: globals });
    expect(state.chatVars.a).toBe("1");
    expect(state.log).toEqual(["done"]);
  });

  test("a name we never injected does not exist in the card (deny-by-absence)", async () => {
    const state = freshState();
    const { globals } = createRisuApi(state);
    expect(await runLua("return deleteEverything == nil", { capabilities: globals })).toEqual({
      ok: true,
      value: true,
    });
  });
});
