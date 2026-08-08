/**
 * The window's conversation, projected onto the shape Kit's session commands expect.
 *
 * THIS IS THE JOIN THAT MAKES /export AND /rewind REAL. Kit's formatter and its rewind bounds both
 * take a Session; the window has lines. If that projection is wrong, `/export` writes a document
 * with the turns in the wrong shape and nothing complains, because a malformed Session is still a
 * Session as far as the formatter is concerned.
 */
import { describe, expect, test } from "bun:test";
import { turnBounds } from "../../kit/sessions/projection";
import { formatTranscript } from "../../kit/sessions/transcript";
import { sessionFromMessages, windowSessions } from "./command-sessions";
import type { CommandEffect } from "./command-core";

const at = 1_700_000_000_000;

describe("a conversation as a session", () => {
  test("a turn opens where somebody spoke and carries what followed", () => {
    const session = sessionFromMessages([
      { role: "user", content: "what is in the studio" },
      { role: "assistant", content: "six decks" },
      { role: "assistant", content: "and one damaged file" },
      { role: "user", content: "which one" },
      { role: "assistant", content: "wren.json" },
    ], "s1", at);

    expect(session.turns).toHaveLength(2);
    expect(session.turns[0]?.input).toBe("what is in the studio");
    // The user's own line rides inside the turn too, which is how Kit builds one and what makes the
    // exported markdown read as a conversation rather than a list of answers.
    expect(session.turns[0]?.messages.map((m) => m.role)).toEqual(["user", "assistant", "assistant"]);
    expect(session.turns[1]?.messages).toHaveLength(2);
  });

  test("an empty conversation is an empty session, not a turn full of nothing", () => {
    expect(sessionFromMessages([], "s1", at).turns).toEqual([]);
  });

  test("A REPLY BEFORE ANYBODY SPOKE IS STILL KEPT", () => {
    /**
     * A restored transcript can open on an assistant line. Dropping it would make the export quietly
     * shorter than the conversation it claims to be.
     */
    const session = sessionFromMessages([{ role: "assistant", content: "hello" }], "s1", at);
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.messages.some((m) => m.content === "hello")).toBe(true);
  });

  test("it feeds Kit's own formatter and its own rewind bounds", () => {
    const session = sessionFromMessages([
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
      { role: "assistant", content: "second answer" },
    ], "abcd1234", at);

    const written = formatTranscript(session, "markdown");
    expect(written.filename.endsWith(".md")).toBe(true);
    expect(written.body).toContain("first question");
    expect(written.body).toContain("second answer");

    // Two turns give two rewind targets: the start, and the state after the first.
    expect(turnBounds(session).map((b) => b.turn)).toEqual([0, 1]);
    expect(turnBounds(session)[1]?.preview).toBe("first question");
  });
});

describe("the actions", () => {
  const talk = [
    { role: "user" as const, content: "first question" },
    { role: "assistant" as const, content: "first answer" },
    { role: "user" as const, content: "second question" },
  ];

  test("A VOID ACTION THAT READS THE DISK HANDS ITS WORK BACK", async () => {
    /**
     * Found by running the real window: `/session` printed nothing. `openPlaybill` is declared void
     * and Kit's command calls it without an await - in the terminal it flips a view flag, here it
     * reads a directory - so the effects were collected and returned while the read was in flight.
     * Deferring it is what makes "the command finished" true.
     */
    const effects: CommandEffect[] = [];
    const work: Promise<unknown>[] = [];
    const actions = windowSessions(talk, (e) => effects.push(e), (p) => work.push(p));

    actions.openPlaybill();
    expect(work).toHaveLength(1);
    // Nothing yet: this is precisely the moment the effects used to be sent.
    expect(effects).toHaveLength(0);

    await Promise.allSettled(work);
    expect(effects.length).toBeGreaterThan(0);
  });

  test("the rewind picker offers this conversation's own turns, and writes nothing", () => {
    const effects: CommandEffect[] = [];
    windowSessions(talk, (e) => effects.push(e), () => undefined).openRail();

    const rows = effects[0];
    expect(rows?.kind).toBe("rows");
    expect(rows?.kind === "rows" && rows.rows.map((r) => r.keep)).toEqual([0, 1]);
    expect(rows?.kind === "rows" && rows.hint).toContain("No saved session is edited");
  });

  test("the acts Kit's terminal owns are refused by name, not silently skipped", async () => {
    const effects: CommandEffect[] = [];
    const actions = windowSessions(talk, (e) => effects.push(e), () => undefined);
    await actions.rewind(1);
    actions.fresh();
    expect(effects.map((e) => e.kind === "say" && e.text)).toEqual([
      "The window cannot rewrite a saved session. Kit's terminal owns the saved session it is holding.",
      "The window cannot start a new saved session. Kit's terminal owns the saved session it is holding.",
    ]);
  });
});
