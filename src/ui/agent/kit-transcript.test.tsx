/**
 * The transcript, actually rendered.
 *
 * The core tests prove the rules. This proves the WIRING - that a reply reaches the markdown
 * renderer, that a long one folds, that a question the agent asked becomes a panel and not a
 * sentence, and that a failure is a red-spined band rather than a stray paragraph. Every one of
 * those passed typecheck while the window still printed plain text, which is exactly the kind of
 * layer this repo has shipped broken before.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LONG_SAY_CHARS } from "../../kit/render/say-fold";
import { Transcript } from "./kit-transcript";
import type { ChatLine } from "./turn";

const draw = (lines: ChatLine[], extra?: { streaming?: string; problem?: string }): string =>
  renderToStaticMarkup(
    <Transcript
      lines={lines}
      streaming={extra?.streaming ?? ""}
      busy={false}
      problem={extra?.problem ?? null}
      acts={{ onSend: () => undefined, onRewind: () => undefined }}
      onFold={() => undefined}
      onNotice={() => undefined}
      onAnswer={() => undefined}
    />,
  );

describe("what each role gets", () => {
  test("THE AGENT'S WORDS ARE MARKDOWN AND YOURS ARE NOT", () => {
    /**
     * Your own line is what you typed and must read back as typed; parsing it would let a stray
     * asterisk restyle somebody's own sentence. The agent's is a rendered answer.
     */
    const out = draw([
      { role: "user", text: "why is *this* broken" },
      { role: "assistant", text: "because **that** is." },
    ]);
    expect(out).toContain("why is *this* broken");
    expect(out).toContain("<strong");
    expect(out).toContain("kit-md");
  });

  test("a tool row keeps its verb colour", () => {
    const out = draw([{ role: "tool", text: "studio_read: 2 pieces", tool: "studio_read" }]);
    expect(out).toContain("var(--kit-verb-read)");
  });

  test("every band can be copied", () => {
    const out = draw([{ role: "assistant", text: "here is the path" }]);
    expect(out).toContain("kit-band__copy");
  });

  test("a reply still arriving renders as markdown too", () => {
    const out = draw([], { streaming: "# working\n\n- one" });
    expect(out).toContain("kit-md__head");
    expect(out).toContain("kit-md__li");
  });
});

describe("the fold", () => {
  const long = "x".repeat(LONG_SAY_CHARS + 1);

  test("A LONG REPLY FOLDS ONLY ONCE THERE IS A NEWER ONE", () => {
    /**
     * Folding exists to keep scrollback from being a wall, and the reply you are reading is not
     * scrollback. With one reply on screen nothing folds; add a second and the first collapses.
     */
    expect(draw([{ role: "assistant", text: long }])).not.toContain("kit-fold");
    const two = draw([{ role: "assistant", text: long }, { role: "assistant", text: long }]);
    expect(two).toContain("kit-fold");
    expect(two).toContain("chars");
  });

  test("a short reply never folds, however many follow it", () => {
    const out = draw([
      { role: "assistant", text: "short" },
      { role: "assistant", text: "also short" },
    ]);
    expect(out).not.toContain("kit-fold");
  });

  test("an explicit toggle wins over the newest-reply rule", () => {
    const out = draw([{ role: "assistant", text: long, open: false }]);
    expect(out).toContain("kit-fold");
  });
});

describe("a question the agent asked", () => {
  const asked: ChatLine = {
    role: "tool",
    text: "ask_choice: 2 options",
    tool: "ask_choice",
    choices: {
      question: "Which preset should I base it on?",
      options: [{ value: "empty-base", note: "nothing set" }, { value: "paramnesia-vi-rc" }],
    },
  };

  test("it becomes a panel, with its options and their reasons", () => {
    const out = draw([asked]);
    expect(out).toContain("PICK ONE");
    expect(out).toContain("Which preset should I base it on?");
    expect(out).toContain("empty-base");
    expect(out).toContain("nothing set");
    expect(out).toContain("Write your own answer");
    expect(out).toContain("Chat about this instead");
  });

  test("NOTHING IS ARMED BEFORE A CHOICE IS MADE - and the send button says so", () => {
    // The two visible steps are what make sending straight to the model safe.
    const out = draw([asked]);
    expect(out).toContain("sends empty-base");
    expect(out).toContain("Send");
  });

  test("AN ANSWERED PANEL COLLAPSES, so the same question cannot be answered twice", () => {
    const out = draw([{ ...asked, answered: "empty-base" }]);
    expect(out).toContain("kit-ask--done");
    expect(out).toContain("empty-base");
    expect(out).not.toContain("PICK ONE");
  });

  test("a tool row with no question is just a tool row", () => {
    expect(draw([{ role: "tool", text: "studio_read: ok", tool: "studio_read" }])).not.toContain("kit-ask");
  });
});

describe("a failure", () => {
  test("it is a band with a red spine, not a paragraph that reads like speech", () => {
    const out = draw([], { problem: "The server refused the turn (429)." });
    expect(out).toContain("kit-error");
    expect(out).toContain("The server refused the turn (429).");
  });

  test("AN UNBOUNDED FAILURE CANNOT TAKE THE TRANSCRIPT WITH IT", () => {
    // A proxy returning an HTML error page is the normal case this guards against.
    const out = draw([], { problem: `boom ${"x".repeat(5_000)}` });
    expect(out).toContain("boom");
    expect((out.match(/x/g) ?? []).length).toBeLessThanOrEqual(600);
  });
});
