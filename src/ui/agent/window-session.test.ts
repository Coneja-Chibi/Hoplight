/**
 * The window saving its own conversation, and never anybody else's.
 *
 * The whole reason the window did not save at all was a fear of two writers over one session file.
 * The answer is ownership in the ID, so the tests that matter are the refusals: an id the window
 * does not own must not be writable, however the request is shaped.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isWindowSessionId,
  newWindowSessionId,
  recordWindowTurn,
  turnMessages,
} from "./window-session";
import { parseTurn } from "./server-agent";
import { createSessionStore } from "../../kit/sessions/store";
import { gateGrantsForTest, rememberGateChoice } from "./turn-stream";

describe("owning an id", () => {
  test("a minted id is one the window may write", () => {
    expect(isWindowSessionId(newWindowSessionId())).toBe(true);
  });

  test("A TERMINAL SESSION ID IS NOT WRITABLE FROM HERE", () => {
    /**
     * The hazard the old "never write" rule existed for: the terminal stamps its session every
     * turn, and a browser tab stamping the same file loses turns to whoever wrote last. Kit's ids
     * are bare uuids, so they can never carry the prefix.
     */
    expect(isWindowSessionId("6f1b6b6e-6c3a-4a1a-9a2b-0f1e2d3c4b5a")).toBe(false);
  });

  test("NOTHING THAT COULD BECOME A PATH", () => {
    // The id becomes a filename. This is the last place a traversal can be turned away.
    expect(isWindowSessionId("w-../../etc/passwd")).toBe(false);
    expect(isWindowSessionId("w-a/b")).toBe(false);
    expect(isWindowSessionId("w-a.b")).toBe(false);
    expect(isWindowSessionId(`w-${"a".repeat(200)}`)).toBe(false);
    expect(isWindowSessionId("w-")).toBe(false);
    expect(isWindowSessionId(42)).toBe(false);
    expect(isWindowSessionId(null)).toBe(false);
  });

  test("the turn boundary refuses an id the window does not own", () => {
    const body = { messages: [{ role: "user", content: "hi" }] };
    expect(parseTurn({ ...body, sessionId: "6f1b6b6e-6c3a-4a1a-9a2b-0f1e2d3c4b5a" }).ok).toBe(false);
    expect(parseTurn({ ...body, sessionId: "w-../escape" }).ok).toBe(false);
    // Absent is ordinary: the first turn of a conversation has no session yet.
    expect(parseTurn(body).ok).toBe(true);
    expect(parseTurn({ ...body, sessionId: newWindowSessionId() }).ok).toBe(true);
  });
});

describe("turnMessages", () => {
  const all = [
    { role: "user" as const, content: "old" },
    { role: "user" as const, content: "SYSTEM GUIDANCE\n\nwhat is on screen?" },
    { role: "assistant" as const, content: "a preset" },
  ];

  test("THE SAVED PROMPT IS WHAT THE PERSON WROTE, not what the model was sent", () => {
    /**
     * The window prepends the standing instruction and the screen brief before handing the question
     * to the loop. Saved as-is, every session file would carry a copy of somebody's screen and a
     * replay would show it as words they typed.
     */
    const delta = turnMessages(all, 1, "what is on screen?");
    expect(delta[0]).toEqual({ role: "user", content: "what is on screen?" });
    expect(JSON.stringify(delta)).not.toContain("SYSTEM GUIDANCE");
  });

  test("everything the turn produced is kept", () => {
    expect(turnMessages(all, 1, "q")).toHaveLength(2);
  });

  test("it copies rather than editing the loop's own history", () => {
    turnMessages(all, 1, "q");
    expect(all[1]?.content).toContain("SYSTEM GUIDANCE");
  });
});

describe("recordWindowTurn", () => {
  const home = mkdtempSync(join(tmpdir(), "hoplight-winsession-"));
  const previous = process.env["HOME"];
  const previousUser = process.env["USERPROFILE"];
  process.env["HOME"] = home;
  process.env["USERPROFILE"] = home;
  afterAll(() => {
    if (previous === undefined) delete process.env["HOME"]; else process.env["HOME"] = previous;
    if (previousUser === undefined) delete process.env["USERPROFILE"];
    else process.env["USERPROFILE"] = previousUser;
    rmSync(home, { recursive: true, force: true });
  });

  test("A CONVERSATION HERE IS ACTUALLY SAVED, and reads back as itself", async () => {
    /**
     * The claim the whole change is about. Before it, this file wrote nothing: everything said in
     * the window lived in sessionStorage, died with the tab, and `/resume` could only offer the
     * terminal's work.
     */
    const id = newWindowSessionId();
    await recordWindowTurn({
      sessionId: id,
      question: "make me a preset",
      messages: [
        { role: "user", content: "SYSTEM GUIDANCE\n\nmake me a preset" },
        { role: "assistant", content: "staged one" },
      ],
      historyLength: 0,
    });
    const held = await createSessionStore().read(id);
    expect(held?.turns).toHaveLength(1);
    expect(held?.turns[0]?.input).toBe("make me a preset");
    // The guidance and screen brief are not in the record; what the person wrote is.
    expect(JSON.stringify(held)).not.toContain("SYSTEM GUIDANCE");

    // And a second turn APPENDS rather than replacing, which is what makes it a conversation.
    await recordWindowTurn({
      sessionId: id,
      question: "another",
      messages: [{ role: "user", content: "another" }, { role: "assistant", content: "ok" }],
      historyLength: 0,
    });
    expect((await createSessionStore().read(id))?.turns).toHaveLength(2);
  });

  test("it shows up in the list `/resume` reads", async () => {
    const id = newWindowSessionId();
    await recordWindowTurn({
      sessionId: id,
      question: "find it",
      messages: [{ role: "user", content: "find it" }, { role: "assistant", content: "here" }],
      historyLength: 0,
    });
    expect((await createSessionStore().list()).some((s) => s.id === id)).toBe(true);
  });

  test("AN ID THE WINDOW DOES NOT OWN WRITES NOTHING AT ALL", async () => {
    // Belt and braces: even reached directly, past the route, it refuses to touch the file.
    await recordWindowTurn({
      sessionId: "6f1b6b6e-6c3a-4a1a-9a2b-0f1e2d3c4b5a",
      question: "hi",
      messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
      historyLength: 0,
    });
    const dirs = existsSync(home) ? readdirSync(home) : [];
    // Nothing was created for it anywhere under the fake home.
    expect(JSON.stringify(dirs)).not.toContain("6f1b6b6e");
  });

  test("A TURN THAT PRODUCED NOTHING IS NOT A TURN", async () => {
    // An aborted turn leaves no delta; writing an empty turn would pad the session with blanks.
    const id = newWindowSessionId();
    await recordWindowTurn({ sessionId: id, question: "hi", messages: [], historyLength: 0 });
    expect(JSON.stringify(readdirSync(home))).not.toContain(id);
  });

  test("IT NEVER THROWS, AND IT NEVER STAYS QUIET EITHER", async () => {
    /**
     * The conversation already happened and is on screen: losing its record is bad, losing the
     * answer too because the record failed would be worse. But the first build of this swallowed
     * the reason entirely, so a conversation that was never saved looked exactly like one that was.
     * Both halves are the contract now - it returns rather than throws, and it says which happened.
     */
    const saved = await recordWindowTurn({
      sessionId: newWindowSessionId(),
      question: "hi",
      messages: [{ role: "user", content: "hi" }],
      historyLength: 0,
    });
    expect(saved.saved).toBe(true);

    const refused = await recordWindowTurn({
      sessionId: "not-ours",
      question: "hi",
      messages: [{ role: "user", content: "hi" }],
      historyLength: 0,
    });
    expect(refused).toEqual({ saved: false, why: "not a window session id: not-ours" });

    // An empty turn says what it counted, so "nothing to save" can be told from "it broke".
    const empty = await recordWindowTurn({
      sessionId: newWindowSessionId(),
      question: "hi",
      messages: [],
      historyLength: 0,
    });
    expect(empty.saved === false && empty.why).toContain("no new messages");
  });
});

describe("allow for this session", () => {
  test("AN ALLOWANCE OUTLIVES THE TURN IT WAS CHOSEN IN", () => {
    /**
     * It did not, and that is the whole complaint: the window seeded each turn with a fresh empty
     * grant set, so "allow for session" held for the rest of THAT turn and was gone by the next
     * question. The same permission got asked five times and answering it changed nothing, which is
     * how people learn to click through the prompt that actually matters.
     *
     * Recorded from the CHOICE rather than read back off the state, because applyGateChoice is pure
     * and folds each choice into a new state the dispatch keeps to itself.
     */
    rememberGateChoice({ type: "allow-session" }, "studio_export");
    expect([...gateGrantsForTest()]).toContain("studio_export");
  });

  test("only allow-session grants; a one-shot yes does not", () => {
    // allow-once and hold are deliberately one-shot: answering a question about a call must never
    // be a way to end up having permitted every later one.
    const before = [...gateGrantsForTest()].length;
    rememberGateChoice({ type: "allow-once" }, "studio_delete");
    rememberGateChoice({ type: "hold" }, "studio_delete");
    rememberGateChoice(null, "studio_delete");
    expect([...gateGrantsForTest()].length).toBe(before);
  });
});
