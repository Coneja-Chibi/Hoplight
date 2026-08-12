/**
 * The floating panel, rendered.
 *
 * It exists because typecheck is perfectly happy with a panel whose class names match no stylesheet
 * and which therefore mounts as a column of unstyled text in the top-left corner - a failure this
 * session has already shipped once.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppContext } from "../app-contract";
import { FloatingAgent } from "./floating-agent";

/** Only the members AgentRoom touches; the rest of AppContext is irrelevant here. */
/**
 * Enough of a context to render. `prefs` is real rather than absent because the panel reads one to
 * decide whether it is minimised, and a double that omits what the component uses tests a component
 * nobody ships.
 */
const ctx = ({
  apps: () => [],
  prefs: { get: () => undefined, set: () => undefined },
  // Read through the context, for the reason app-contract.ts records: a bundled app importing
  // live-state reads its own empty copy of it.
  agent: { publish: () => undefined, current: () => null, onChange: () => () => undefined },
}) as unknown as AppContext;

const render = (open: boolean): string =>
  renderToStaticMarkup(<FloatingAgent ctx={ctx} open={open} onClose={() => undefined} />);

describe("FloatingAgent", () => {
  test("closed draws nothing at all", () => {
    // Not hidden with CSS: a panel that is merely invisible still holds a live transcript, an open
    // SSE stream, and a share of the keyboard.
    expect(render(false)).toBe("");
  });

  test("IT IS POSITIONED, and carries the marker its own drag code looks for", () => {
    /**
     * `data-agent-panel` is how the grab handler finds the panel's rectangle to compute the grab
     * offset. Without it the offset falls back to zero and the panel jumps its own corner to the
     * cursor on every drag, which reads as being snatched rather than moved.
     */
    const html = render(true);
    expect(html).toContain("data-agent-panel");
    /**
     * The position is inline because it changes on every drag frame; everything else is the
     * stylesheet's. A NEGATIVE left is legal and deliberate - a wide panel on a narrow window may
     * hang off the left so its right-hand side stays usable - so this is not `\d+`. The suite
     * installs a jsdom window with its own size, which is exactly the case that catches it.
     */
    expect(html).toMatch(/left:-?\d+px/);
    expect(html).toMatch(/top:\d+px/);
    expect(html).toMatch(/width:\d+px/);
  });

  test("EVERY CLASS IT USES EXISTS IN ITS STYLESHEET", () => {
    /**
     * A render test cannot catch this: `bun test` resolves a CSS module to an empty object, so the
     * markup comes out with no class attributes at all and every assertion about styling passes
     * vacuously. The panel would mount unstyled - fixed positioning gone, so it lands in the page
     * flow at the top of the document - and nothing in the suite would notice.
     *
     * So the two files are compared directly instead.
     */
    const tsx = readFileSync(new URL("./floating-agent.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./floating-agent.module.css", import.meta.url), "utf8");

    const used = new Set([...tsx.matchAll(/styles\.(\w+)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(4);
    for (const name of used) expect(css).toContain(`.${String(name)}`);
  });

  test("the header is there to grab, and there is a way out", () => {
    const html = render(true);
    expect(html).toContain("THE AGENT");
    expect(html).toContain('aria-label="Close the agent"');
  });

  test("IT IS THE SAME ROOM, not a second agent", () => {
    /**
     * The panel renders AgentRoom itself. Two agent surfaces would mean two transcripts and two
     * conversations about the same screen, and whichever one you were not looking at would be the
     * one holding the answer.
     */
    const html = render(true);
    expect(html).toContain("agent-room");
    expect(html).toContain("Ask about what is on the screen behind this window.");
  });

  test("NOTHING BEHIND IT IS BLOCKED", () => {
    /**
     * Not modal, on purpose. A backdrop would recreate the dock app's problem in overlay form: you
     * could not click the thing you were asking about while asking about it, which is the entire
     * reason this panel exists instead of a page.
     */
    const html = render(true);
    expect(html).not.toContain('aria-modal="true"');
    expect(html).not.toContain("backdrop");
  });
});

describe("resizing", () => {
  test("ALL EIGHT EDGES AND CORNERS ARE THERE", () => {
    /**
     * A panel you can only grow from one corner is a panel you cannot make wider without also
     * making it taller. All eight are generated from one list, so none can quietly go missing while
     * the others keep working.
     */
    const html = render(true);
    for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      expect(html).toContain(`data-edge="${edge}"`);
    }
  });

  test("EVERY HANDLE CLASS EXISTS IN THE STYLESHEET, cursor included", () => {
    /**
     * The cursor IS the affordance here: the handles are deliberately invisible bands, so a class
     * that resolves to nothing leaves an edge that looks identical and does nothing. A render test
     * cannot catch it - bun resolves a CSS module to an empty object - so the two files are read.
     */
    const css = readFileSync(new URL("./floating-agent.module.css", import.meta.url), "utf8");
    for (const edge of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
      expect(css).toContain(`.h${edge}`);
    }
    for (const cursor of ["ns-resize", "ew-resize", "nesw-resize", "nwse-resize"]) {
      expect(css).toContain(cursor);
    }
  });

  test("the handles carry no text, so nothing reads them aloud as content", () => {
    // They are bands, not glyphs. The south-east mark is a border for the same reason: it cannot be
    // selected, copied, or announced.
    const html = render(true);
    expect(html).not.toMatch(/data-edge="se"[^>]*>[^<]+</);
  });
});

describe("the panel fills its own height", () => {
  test("THE TRANSCRIPT DOES NOT CARRY THE BLOCK CLASS", () => {
    /**
     * `.agent-room__block` sets `flex:none` and is declared after `.agent-room__talk`'s `flex:1` at
     * equal specificity, so putting both on one element silently pinned the transcript to its
     * content height. The conversation bunched at the top and the rest of the panel sat empty -
     * which reads as the window being broken rather than as a stylesheet collision.
     *
     * Asserted on the markup because the cascade itself is unreachable from a test here: bun
     * resolves the CSS module to nothing and the injected style string is never applied.
     */
    const html = render(true);
    expect(html).toContain('class="agent-room__talk"');
    expect(html).not.toContain("agent-room__block agent-room__talk");
  });

  test("the composer sits after the transcript, so it lands at the bottom", () => {
    // With the transcript taking the slack, source order is what puts the composer against the
    // floor of the panel. If it ever moved above the transcript it would float mid-panel.
    const html = render(true);
    expect(html.indexOf("agent-room__talk")).toBeLessThan(html.indexOf("agent-room__composer"));
  });
});
