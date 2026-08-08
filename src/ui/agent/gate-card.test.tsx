/**
 * What the Gate actually shows somebody before they authorise a write.
 *
 * These read like copy tests and they are not. This card is the entire human step between a model
 * deciding to change a file and the file changing, so a warning it does not render is a warning
 * nobody saw, and a button it does not offer is an answer nobody could give.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GateCard, type GateView } from "./gate-card";

const render = (request: GateView | null): string =>
  renderToStaticMarkup(<GateCard request={request} onAnswer={() => undefined} />);

describe("GateCard", () => {
  test("nothing to decide draws nothing", () => {
    expect(render(null)).toBe("");
  });

  test("WARNINGS ARE SHOWN IN FULL, not counted", () => {
    /**
     * The reason to say no is always in the words. "3 warnings" makes a card look careful while
     * telling somebody nothing they can act on, and this is the one moment where being told
     * precisely what is about to happen is the entire value of the surface.
     */
    const html = render({
      id: "t:1:0",
      name: "change_apply",
      review: {
        title: "Rewrite HawThorne",
        warnings: ["this replaces 3 blocks", "one block is not in the preset any more"],
      },
    });

    expect(html).toContain("this replaces 3 blocks");
    expect(html).toContain("one block is not in the preset any more");
    expect(html).not.toContain("2 warnings");
  });

  test("it names the tool that wants to write", () => {
    // Somebody deciding about a write deserves to know what is doing the writing.
    expect(render({ id: "t:1:0", name: "studio_delete" })).toContain("studio_delete");
  });

  test("EVERY ANSWER KIT UNDERSTANDS IS OFFERED", () => {
    /**
     * An answer with no button is an answer nobody can give. `hold` especially: it stops the call
     * without deciding against it, and it is the only one that invites a follow-up question instead
     * of ending the subject.
     */
    const html = render({ id: "t:1:0", name: "change_apply" });

    expect(html).toContain("Allow once");
    expect(html).toContain("Allow for this session");
    expect(html).toContain(">No<");
    expect(html).toContain("Wait, tell me more");
    expect(html).toContain("Stop the whole turn");
  });

  test("THERE IS NO WAY TO CLOSE IT WITHOUT ANSWERING", () => {
    // A gate that can be dismissed is a gate that gets dismissed, and on the server a dispatch loop
    // is parked on this card's answer. Every exit is a decision.
    const html = render({ id: "t:1:0", name: "change_apply" });
    expect(html).not.toContain("aria-label=\"close\"");
    expect(html).not.toContain(">×<");
  });

  test("it announces itself as something needing an answer", () => {
    // A screen reader must not have to discover this by tabbing into it.
    const html = render({ id: "t:1:0", name: "change_apply" });
    expect(html).toContain('role="alertdialog"');
  });

  test("a request that arrived thin still renders", () => {
    // It crossed a wire. Missing review, missing peek, missing verdict: the card is still the only
    // thing between a model and somebody's file, so it must not blank out.
    const html = render({ id: "t:1:0" });
    expect(html).toContain("Allow once");
    expect(html).toContain("a change");
  });

  test("crossing and peek detail are shown alongside the review", () => {
    const html = render({
      id: "t:1:0",
      peek: { title: "export", lines: ["writes hawthorne.json"] },
      crossing: { lines: ["3 fields will not survive the conversion"] },
    });
    expect(html).toContain("writes hawthorne.json");
    expect(html).toContain("3 fields will not survive");
  });
});
