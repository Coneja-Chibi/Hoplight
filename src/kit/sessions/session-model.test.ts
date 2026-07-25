/** Session-model tests for titles, turns, forks, renames, and immutable updates. */
import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "../providers/provider";
import {
  appendTurn,
  buildTurn,
  deriveTitle,
  emptySession,
  forkFrom,
  renameSession,
  rewindTo,
  type Session,
} from "./session-model";

const msg = (content: string, role: ModelMessage["role"] = "user"): ModelMessage => ({ role, content });

/** A three-turn session with distinct timestamps for the ordering + clamp assertions. */
const threeTurns = (): Session => {
  let s = emptySession("root", 1000);
  s = appendTurn(s, buildTurn("first thing", [msg("first thing")], 2000));
  s = appendTurn(s, buildTurn("second thing", [msg("second thing")], 3000));
  s = appendTurn(s, buildTurn("third thing", [msg("third thing")], 4000));
  return s;
};

describe("session-model", () => {
  test("emptySession stamps one clock reading and no turns", () => {
    const s = emptySession("abc", 5);
    expect(s).toEqual({
      version: 1,
      id: "abc",
      title: null,
      createdAt: 5,
      updatedAt: 5,
      parent: null,
      turns: [],
    });
  });

  test("appendTurn advances updatedAt to the turn's own timestamp, not just any truthy value", () => {
    const s = appendTurn(emptySession("a", 100), buildTurn("hi", [msg("hi")], 777));
    expect(s.updatedAt).toBe(777);
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0]?.messages).toEqual([msg("hi")]);
  });

  test("appendTurn does not mutate its input", () => {
    const before = emptySession("a", 100);
    appendTurn(before, buildTurn("hi", [msg("hi")], 200));
    expect(before.turns).toHaveLength(0);
    expect(before.updatedAt).toBe(100);
  });

  test("rewindTo keeps the first N turns and bumps updatedAt", () => {
    const s = rewindTo(threeTurns(), 2, 9000);
    expect(s.turns.map((t) => t.input)).toEqual(["first thing", "second thing"]);
    expect(s.updatedAt).toBe(9000);
  });

  test("rewindTo with keep >= length is a no-op returning a deep-equal session", () => {
    const s = threeTurns();
    expect(rewindTo(s, 3, 9000)).toEqual(s);
    expect(rewindTo(s, 99, 9000)).toEqual(s);
  });

  test("rewindTo clamps a negative keep to empty", () => {
    expect(rewindTo(threeTurns(), -5, 9000).turns).toHaveLength(0);
  });

  test("forkFrom copies [0, keep), sets parent {id,turn}, stamps fresh timestamps", () => {
    const source = threeTurns();
    const fork = forkFrom(source, 2, "fork-1", 8888);
    expect(fork.id).toBe("fork-1");
    expect(fork.parent).toEqual({ id: "root", turn: 2 });
    expect(fork.createdAt).toBe(8888);
    expect(fork.updatedAt).toBe(8888);
    expect(fork.turns.map((t) => t.input)).toEqual(["first thing", "second thing"]);
  });

  test("forkFrom leaves the source's turns referentially unchanged", () => {
    const source = threeTurns();
    const turnsRef = source.turns;
    forkFrom(source, 1, "fork-2", 8888);
    expect(source.turns).toBe(turnsRef);
    expect(source.turns).toHaveLength(3);
  });

  test("forkFrom at index 0 yields a valid blank branch", () => {
    const fork = forkFrom(threeTurns(), 0, "fork-3", 8888);
    expect(fork.turns).toHaveLength(0);
    expect(fork.parent).toEqual({ id: "root", turn: 0 });
  });

  test("renameSession sets the title without clobbering turns or lineage", () => {
    const fork = forkFrom(threeTurns(), 2, "fork-4", 8888);
    const named = renameSession(fork, "  combat math  ", 9999);
    expect(named.title).toBe("combat math");
    expect(named.updatedAt).toBe(9999);
    expect(named.turns).toHaveLength(2);
    expect(named.parent).toEqual({ id: "root", turn: 2 });
  });

  test("renameSession with a blank title clears back to derived (null)", () => {
    const named = renameSession(renameSession(emptySession("a", 1), "x", 2), "   ", 3);
    expect(named.title).toBeNull();
  });

  test("deriveTitle collapses whitespace and falls back on an empty session", () => {
    expect(deriveTitle([])).toBe("Untitled session");
    let s = emptySession("a", 1);
    s = appendTurn(s, buildTurn("  draw   steel\ncombat  ", [msg("x")], 2));
    expect(deriveTitle(s.turns)).toBe("draw steel combat");
  });

  test("deriveTitle caps long input with an ellipsis", () => {
    const long = "a".repeat(100);
    const title = deriveTitle([{ input: long, messages: [], at: 1 }], 10);
    expect(title).toBe(`${"a".repeat(10)}…`);
  });

  test("deriveTitle falls back when the first input is only whitespace", () => {
    expect(deriveTitle([{ input: "   \n\t ", messages: [], at: 1 }])).toBe("Untitled session");
  });
});
