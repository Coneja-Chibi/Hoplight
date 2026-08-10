/**
 * When a fresh read is allowed into an editor that is already open.
 *
 * MOUNTED, not lifted. The old version of this file asserted a hand-written copy of the rule, and
 * the copy said "a held read lands once the edits are saved" while the hook was keyed on the
 * revision alone - so the moment the edits were saved, nothing re-ran it. Every case passed and the
 * behaviour was wrong. A predicate cannot tell you whether the code ever runs a second time.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useReseedOnReread } from "./use-reseed";

let dom: JSDOM;

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
});

afterAll(() => dom.window.close());

interface Harness {
  /** The revisions that were actually taken into the editor, in order. */
  taken: () => readonly string[];
  /** Hand down a new revision and/or a new dirty flag, the way the room and the editor do. */
  render: (revision: string, dirty: boolean) => Promise<void>;
  unmount: () => Promise<void>;
}

async function mount(revision: string, dirty: boolean): Promise<Harness> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const taken: string[] = [];

  function Probe({ rev, dirty: d }: { rev: string; dirty: boolean }): null {
    useReseedOnReread(rev, d, () => { taken.push(rev); });
    return null;
  }

  const render = async (rev: string, d: boolean): Promise<void> => {
    await act(async () => { root.render(<Probe rev={rev} dirty={d} />); });
  };
  await render(revision, dirty);
  return {
    taken: () => taken,
    render,
    unmount: async () => { await act(async () => { root.unmount(); }); },
  };
}

describe("taking a fresh read into an open editor", () => {
  test("what the editor mounted with is not a change", async () => {
    // Re-seeding on mount would clone the body a second time for no reason on every open.
    const h = await mount("r1", false);
    expect(h.taken()).toEqual([]);
    await h.unmount();
  });

  test("a new revision on a clean editor is taken", async () => {
    const h = await mount("r1", false);
    await h.render("r2", false);
    expect(h.taken()).toEqual(["r2"]);
    await h.unmount();
  });

  test("THE SAME REVISION IS NOT A CHANGE", async () => {
    /**
     * The room rebuilds and re-renders constantly - a status message, a tab, a keystroke elsewhere.
     * Keyed on the entity object instead of the revision, this would re-seed continuously and wipe
     * the editor as fast as somebody typed into it.
     */
    const h = await mount("r1", false);
    await h.render("r1", false);
    await h.render("r1", false);
    expect(h.taken()).toEqual([]);
    await h.unmount();
  });

  test("A DIRTY EDITOR IS NEVER OVERWRITTEN", async () => {
    // Re-seeding here would throw away somebody's edits to show them a fresher copy.
    const h = await mount("r1", true);
    await h.render("r2", true);
    expect(h.taken()).toEqual([]);
    await h.unmount();
  });

  test("HOLDING IS NOT SWALLOWING: the change lands once the edits are gone", async () => {
    /**
     * THE REGRESSION. Keyed on the revision alone, the effect had nothing left to re-run it after
     * the edits were saved, so a held read waited for a SECOND write to the same file - and if none
     * came, the editor stayed stale for the life of the tab while claiming to be live.
     */
    const h = await mount("r1", true);
    await h.render("r2", true);
    expect(h.taken()).toEqual([]);
    await h.render("r2", false);
    expect(h.taken()).toEqual(["r2"]);
    await h.unmount();
  });

  test("and it lands ONCE, however many renders follow", async () => {
    const h = await mount("r1", true);
    await h.render("r2", true);
    await h.render("r2", false);
    await h.render("r2", false);
    await h.render("r2", true);
    await h.render("r2", false);
    expect(h.taken()).toEqual(["r2"]);
    await h.unmount();
  });
});
