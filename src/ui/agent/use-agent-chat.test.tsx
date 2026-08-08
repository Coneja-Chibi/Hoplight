/**
 * The conversation's state machine, driven through a real render.
 *
 * IT MOUNTS, because the two defects this file pins are both about ORDER, and order only exists
 * once React is batching. Neither is visible to a pure test of any single function:
 *
 *  - answering a question marks its panel answered and then sends, and `send` used to write a
 *    snapshot of the line list straight back into state - discarding the mark queued beside it, so
 *    a question stayed live on screen after it had been answered;
 *  - `send` refuses while a turn is running, so answering during one would have collapsed a panel
 *    to an answer that never left, with no way back to the options.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { useAgentChat, type AgentChat, type SlashSeam } from "./use-agent-chat";
import { clearTranscript } from "./transcript-store";
import { asKitCommands, type CommandEffect, type CommandInfo } from "./command-core";

beforeAll(() => {
  const dom = new JSDOM("<!doctype html><div id=\"root\"></div>", { pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  g["window"] = dom.window;
  g["document"] = dom.window.document;
  g["navigator"] = dom.window.navigator;
  g["HTMLElement"] = dom.window.HTMLElement;
  g["Element"] = dom.window.Element;
  g["Node"] = dom.window.Node;
  g["IS_REACT_ACT_ENVIRONMENT"] = false;
  // The hook persists on every change; a map is enough and keeps tests from leaning on a browser.
  const store = new Map<string, string>();
  g["sessionStorage"] = {
    getItem: (k: string): string | null => store.get(k) ?? null,
    setItem: (k: string, v: string): void => { store.set(k, v); },
    removeItem: (k: string): void => { store.delete(k); },
  };
});

beforeEach(() => { clearTranscript(); });

/** One frame on the wire, in the server's format. */
const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** A streaming Response over the given frames. */
const responseOf = (frames: readonly string[]): Response =>
  new Response(new TextEncoder().encode(frames.join("")), { status: 200 });

interface Harness {
  chat: () => AgentChat;
  root: Root;
  posts: number;
  bodies: unknown[];
  /** Command lines that reached the server, and the shell effects the window was asked to carry. */
  ran: string[];
  shelled: CommandEffect[];
}

/** Mount the hook and hand back a live handle on it. Its own container, so roots never collide. */
function mount(
  reply: (bodies: unknown[]) => Promise<Response> | Response,
  commands?: readonly CommandInfo[],
  effectsFor?: (line: string) => readonly CommandEffect[],
): Harness {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const state: { current: AgentChat | null } = { current: null };
  const harness: Harness = {
    chat: () => {
      if (!state.current) throw new Error("not mounted");
      return state.current;
    },
    root,
    posts: 0,
    bodies: [],
    ran: [],
    shelled: [],
  };

  const seam: SlashSeam | undefined = commands === undefined
    ? undefined
    : {
      commands: asKitCommands(commands),
      catalog: commands,
      run: (line) => {
        harness.ran.push(line);
        return Promise.resolve(effectsFor?.(line) ?? []);
      },
      shell: (effect) => { harness.shelled.push(effect); },
    };

  function Probe(): null {
    state.current = useAgentChat(
      async (body) => {
        harness.posts += 1;
        harness.bodies.push(body);
        return reply(harness.bodies);
      },
      () => Promise.resolve({}),
      seam,
    );
    return null;
  }

  flushSync(() => { root.render(<Probe />); });
  return harness;
}

/** Run the turn to completion: the stream is already buffered, so one microtask drain is enough. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  await new Promise((resolve) => { setTimeout(resolve, 0); });
};

describe("a question the agent asked", () => {
  test("it becomes a line, parsed once at the boundary", async () => {
    const h = mount(() =>
      responseOf([
        frame("tool", {
          name: "ask_choice",
          summary: "ask_choice: 2 options",
          choices: { question: "Which?", options: [{ value: "a" }, { value: "b" }] },
        }),
        frame("say", { text: "waiting for you" }),
      ]));

    await h.chat().send("go");
    await settle();

    const asked = h.chat().lines.find((l) => l.choices !== undefined);
    expect(asked?.choices?.question).toBe("Which?");
    expect(asked?.choices?.options).toHaveLength(2);
    h.root.unmount();
  });

  test("ANSWERING MARKS THE PANEL AND THE SEND DOES NOT UNDO THE MARK", async () => {
    /**
     * The defect this pins: `send` built the next conversation from a ref and assigned it straight
     * into state, which discarded the "answered" update queued in the same batch. On screen, a
     * question you had just answered stayed live and invited being answered again.
     */
    const h = mount(() =>
      responseOf([
        frame("tool", {
          name: "ask_choice",
          summary: "ask_choice: 2 options",
          choices: { question: "Which?", options: [{ value: "a" }, { value: "b" }] },
        }),
      ]));

    await h.chat().send("go");
    await settle();
    const at = h.chat().lines.findIndex((l) => l.choices !== undefined);
    expect(at).toBeGreaterThanOrEqual(0);

    flushSync(() => { h.chat().answerChoice(at, "a"); });
    await settle();

    expect(h.chat().lines[at]?.answered).toBe("a");
    // And the answer actually went out as an ordinary message.
    expect(h.posts).toBe(2);
    expect(h.chat().lines.some((l) => l.role === "user" && l.text === "a")).toBe(true);
    h.root.unmount();
  });

  test("BOTH HALVES OR NEITHER: answering during a turn does nothing at all", async () => {
    /**
     * One turn at a time is checked on a ref inside `send`, so an answer offered mid-turn would be
     * swallowed. Collapsing the panel anyway would be the worst outcome available: it looks
     * answered, the model never heard it, and the options are gone.
     */
    // Starts as a no-op so it is always callable; the executor replaces it the moment a turn posts.
    let release: (response: Response) => void = () => undefined;
    // A turn that does not finish until this test says so, which is the state being tested.
    const h = mount(() => new Promise<Response>((resolve) => { release = resolve; }));

    let pending: Promise<void> = Promise.resolve();
    flushSync(() => { pending = h.chat().send("first"); });
    expect(h.chat().busy).toBe(true);

    flushSync(() => { h.chat().answerChoice(0, "a"); });
    // Neither half happened: no second post, and nothing was marked answered.
    expect(h.posts).toBe(1);
    expect(h.chat().lines.some((l) => l.answered !== undefined)).toBe(false);

    release(responseOf([frame("say", { text: "ok" })]));
    await pending;
    await settle();
    h.root.unmount();
  });
});

describe("the fold", () => {
  test("THE CALLER SAYS WHICH WAY, so a folded reply opens on the first click", async () => {
    /**
     * `open` is undefined until somebody touches a line, so "flip whatever is there" had no answer
     * for a reply folded by POSITION: the first click wrote the state it was already in and looked
     * broken. The caller passes the state it means.
     */
    const h = mount(() => responseOf([frame("say", { text: "hello" })]));
    await h.chat().send("go");
    await settle();

    const at = h.chat().lines.findIndex((l) => l.role === "assistant");
    flushSync(() => { h.chat().setFold(at, true); });
    expect(h.chat().lines[at]?.open).toBe(true);
    flushSync(() => { h.chat().setFold(at, false); });
    expect(h.chat().lines[at]?.open).toBe(false);
    h.root.unmount();
  });
});

describe("slash commands in the send path", () => {
  const CATALOG: CommandInfo[] = [
    { name: "/decks", summary: "show the studio deck counts", aliases: ["/inventory"], completes: false },
    { name: "/gates", summary: "how often Kit asks before writing", completes: true },
    { name: "/quit", summary: "leave Kit", aliases: ["/q"], completes: false },
  ];

  test("A MATCHED COMMAND NEVER REACHES THE MODEL", async () => {
    /**
     * The whole complaint: `/resume` was typed into this window, went out as prose, and a model
     * answered it. A command is not a question.
     */
    const h = mount(() => responseOf([frame("say", { text: "should never happen" })]), CATALOG, () => [
      { kind: "say", text: "**Studio decks**" },
    ]);

    await h.chat().send("/inventory");
    await settle();

    expect(h.posts).toBe(0);
    expect(h.ran).toEqual(["/inventory"]);
    // What came back is the shell's line, not a message anybody said.
    const drawn = h.chat().lines.at(-1);
    expect(drawn?.role).toBe("kit");
    expect(drawn?.text).toBe("**Studio decks**");
    h.root.unmount();
  });

  test("A SLASH LINE THAT MATCHES NOTHING IS NOT A QUESTION EITHER", async () => {
    /**
     * "/reusme" is a typo. Forwarding it would spend a turn having a model puzzle over somebody's
     * mis-keystroke, which is the more expensive of the two wrong answers.
     */
    const h = mount(() => responseOf([frame("say", { text: "should never happen" })]), CATALOG);
    await h.chat().send("/deck");
    await settle();

    expect(h.posts).toBe(0);
    expect(h.ran).toEqual([]);
    // Kit's own nearest-command rule, so a near miss is named rather than answered with a list.
    expect(h.chat().lines.at(-1)?.text).toContain("/decks");
    expect(h.chat().lines.at(-1)?.role).toBe("kit");
    h.root.unmount();
  });

  test("// IS THE ESCAPE, so a message can still begin with a slash", async () => {
    const h = mount(() => responseOf([frame("say", { text: "ok" })]), CATALOG);
    await h.chat().send("//decks is a folder on my disk");
    await settle();

    expect(h.posts).toBe(1);
    expect(h.chat().lines.some((l) => l.role === "user" && l.text === "/decks is a folder on my disk")).toBe(true);
    h.root.unmount();
  });

  test("A MODEL CANNOT INVOKE A COMMAND THROUGH A CHOICE IT WROTE", async () => {
    /**
     * `ask_choice` options are authored by the model. Routed through `send` they would be matched
     * like something a person typed, so an option labelled "/gates full" would quietly relax the
     * permission deciding whether the model's next write is reviewed.
     */
    const h = mount(
      (bodies) => responseOf(bodies.length === 1
        ? [frame("tool", {
          name: "ask_choice",
          summary: "ask_choice: 1 option",
          choices: { question: "Which?", options: [{ value: "/gates full" }] },
        })]
        : [frame("say", { text: "ok" })]),
      CATALOG,
    );

    await h.chat().send("go");
    await settle();
    const at = h.chat().lines.findIndex((l) => l.choices !== undefined);
    flushSync(() => { h.chat().answerChoice(at, "/gates full"); });
    await settle();

    // It went to the model as an ordinary answer, and no command ran.
    expect(h.ran).toEqual([]);
    expect(h.posts).toBe(2);
    h.root.unmount();
  });

  test("the window carries the effects only it can: navigation and closing", async () => {
    const h = mount(() => responseOf([]), CATALOG, () => [{ kind: "close" }]);
    await h.chat().send("/q");
    await settle();
    expect(h.shelled).toEqual([{ kind: "close" }]);
    // Closing is not a line: it must not narrate itself into the log it is closing.
    expect(h.chat().lines).toHaveLength(0);
    h.root.unmount();
  });

  test("/resume replaces the conversation, and the rewind picker scrubs it", async () => {
    const h = mount(() => responseOf([frame("say", { text: "ok" })]), CATALOG, (line) =>
      line === "/decks"
        ? [{ kind: "transcript", lines: [{ role: "user", text: "old one" }, { role: "assistant", text: "old reply" }] }]
        : []);

    await h.chat().send("here now");
    await settle();
    await h.chat().send("/decks");
    await settle();

    expect(h.chat().lines.map((l) => l.text)).toEqual(["old one", "old reply"]);
    flushSync(() => { h.chat().rewind(0); });
    expect(h.chat().lines).toHaveLength(0);
    h.root.unmount();
  });

  test("a command's output is NOT posted back to the model", async () => {
    const h = mount(() => responseOf([frame("say", { text: "ok" })]), CATALOG, () => [
      { kind: "say", text: "a listing of somebody's private folder" },
    ]);

    await h.chat().send("/decks");
    await settle();
    await h.chat().send("now a real question");
    await settle();

    const posted = (h.bodies[0] as { messages: { content: string }[] }).messages;
    expect(posted.map((m) => m.content)).toEqual(["now a real question"]);
    h.root.unmount();
  });

  test("with no catalog wired, a slash line is prose again rather than a dead composer", async () => {
    const h = mount(() => responseOf([frame("say", { text: "ok" })]));
    await h.chat().send("/decks");
    await settle();
    expect(h.posts).toBe(1);
    h.root.unmount();
  });
});

describe("tokens", () => {
  test("the turn overwrites and the session adds, across turns", async () => {
    const h = mount((bodies) =>
      responseOf([
        frame("usage", { usage: { input: bodies.length * 100, output: 10 } }),
        frame("say", { text: "ok" }),
      ]));

    await h.chat().send("one");
    await settle();
    expect(h.chat().tokens.turn.input).toBe(100);
    expect(h.chat().tokens.session.input).toBe(100);

    await h.chat().send("two");
    await settle();
    expect(h.chat().tokens.turn.input).toBe(200);
    expect(h.chat().tokens.session.input).toBe(300);
    h.root.unmount();
  });
});
