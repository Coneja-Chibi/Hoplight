/** Session projection tests for turn bounds, model history, and summaries. */
import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "../providers/provider";
import { appendTurn, buildTurn, emptySession, forkFrom, renameSession, type Session } from "./session-model";
import { summarize, toHistory, turnBounds } from "./projection";

const msg = (content: string, role: ModelMessage["role"] = "user"): ModelMessage => ({ role, content });

const built = (): Session => {
  let s = emptySession("root", 1000);
  s = appendTurn(s, buildTurn("set up combat", [msg("set up combat"), msg("ok", "assistant")], 2000));
  s = appendTurn(s, buildTurn("goblin attacks", [msg("goblin attacks"), msg("it hits", "assistant")], 3000));
  return s;
};

describe("projection", () => {
  test("toHistory concatenates every turn's messages in order", () => {
    expect(toHistory(built())).toEqual([
      msg("set up combat"),
      msg("ok", "assistant"),
      msg("goblin attacks"),
      msg("it hits", "assistant"),
    ]);
  });

  test("toHistory on an empty session is an empty array", () => {
    expect(toHistory(emptySession("a", 1))).toEqual([]);
  });

  test("summarize uses the user title when set", () => {
    const named = renameSession(built(), "combat night", 5000);
    expect(summarize(named).displayTitle).toBe("combat night");
  });

  test("summarize falls back to the derived title when none is set, and carries parent + count", () => {
    const fork = forkFrom(built(), 1, "fork-1", 6000);
    const s = summarize(fork);
    expect(s.displayTitle).toBe("set up combat");
    expect(s.turnCount).toBe(1);
    expect(s.parent).toEqual({ id: "root", turn: 1 });
    expect(s.updatedAt).toBe(6000);
  });

  test("turnBounds numbers turns 1..N with previews", () => {
    expect(turnBounds(built())).toEqual([
      { turn: 1, at: 2000, preview: "set up combat" },
      { turn: 2, at: 3000, preview: "goblin attacks" },
    ]);
  });

  test("turnBounds caps a long preview and is empty for a fresh session", () => {
    let s = emptySession("a", 1);
    s = appendTurn(s, buildTurn("x".repeat(200), [msg("x")], 2));
    expect(turnBounds(s)[0]?.preview).toBe(`${"x".repeat(60)}…`);
    expect(turnBounds(emptySession("b", 1))).toEqual([]);
  });
});
