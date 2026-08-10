/**
 * Autosave, once it has to survive a save that fails.
 *
 * BOTH BUGS HERE WERE THE SAME SHAPE - a counter that could not tell what it was counting - and
 * both ended with an editor that had silently stopped saving next to a setting that read "on".
 * Neither is visible without mounting: the whole defect is which effects re-run and when.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useEditorGuards, type AutosaveStatus } from "./use-editor-guards";
import { AUTOSAVE_PREF, AUTOSAVE_TRIES } from "./autosave-core";
import type { AppContext, StudioEntitySummary } from "../../app-contract";

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

const PIECE = { id: "astrolabe", kind: "preset", name: "Astrolabe" } as unknown as StudioEntitySummary;

/** Only what the hook actually touches; anything more would be a fake studio, not a double. */
const context = (): AppContext => ({
  prefs: { get: (key: string) => (key === AUTOSAVE_PREF ? true : undefined), set: () => undefined },
  setStatus: () => undefined,
  workbench: { setDirty: () => undefined },
} as unknown as AppContext);

interface Harness {
  saves: () => number;
  status: () => AutosaveStatus;
  render: (dirty: boolean) => Promise<void>;
  unmount: () => Promise<void>;
}

/**
 * Mount the hook with a save whose answer the test chooses.
 *
 * REAL TIMERS, deliberately. The backoff is part of the contract being asserted - three tries that
 * fire on top of each other are not three tries - so the waits are real and short.
 */
async function mount(save: () => Promise<boolean | void>): Promise<Harness> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let saves = 0;
  let latest: AutosaveStatus | null = null;
  const ctx = context();

  function Probe({ dirty }: { dirty: boolean }): null {
    latest = useEditorGuards(ctx, PIECE, dirty, async () => {
      saves += 1;
      return save();
    });
    return null;
  }

  const render = async (dirty: boolean): Promise<void> => {
    await act(async () => { root.render(<Probe dirty={dirty} />); });
  };
  await render(false);
  return {
    saves: () => saves,
    status: () => {
      if (!latest) throw new Error("not mounted");
      return latest;
    },
    render,
    unmount: async () => { await act(async () => { root.unmount(); }); },
  };
}

/**
 * Let real time pass, in slices.
 *
 * SLICED ON PURPOSE. `act` flushes effects when its scope CLOSES, so one long await inside a single
 * act sees the first save, queues the state update, and never re-runs the effect that arms the next
 * timer - the harness would report one attempt no matter how the hook behaved. Each slice is a
 * chance for the re-arm to happen, which is what a real browser gives it.
 */
const settle = async (ms = 8_000, until?: () => boolean): Promise<void> => {
  for (let waited = 0; waited < ms; waited += 100) {
    if (until?.()) return; // stop as soon as the thing being waited for has happened
    await act(async () => { await new Promise((done) => setTimeout(done, 100)); });
  }
};

describe("autosave after a failed save", () => {
  test("A FAILED SAVE RE-ARMS THE TIMER RATHER THAN ENDING AUTOSAVE", async () => {
    /**
     * THE ORIGINAL DEFECT. The effect was keyed on `dirty`; a refused save left dirty true, so
     * nothing changed, so no timer was ever armed again. Autosave was not paused for that piece -
     * it was dead, and the only word about it was one line in a status bar that moved on.
     */
    const h = await mount(async () => false);
    await h.render(true);
    await settle(8_000, () => h.status().stalled);
    expect(h.saves()).toBe(AUTOSAVE_TRIES);
    /**
     * And then it STANDS DOWN AND SAYS SO. The refusal that matters is a revision conflict, and no
     * amount of retrying makes a stale revision current again - so it stops, and the editor has
     * something to put on screen instead of a setting that reads "on" over nothing happening.
     */
    expect(h.status().stalled).toBe(true);
    await h.unmount();
  }, 20_000);

  test("A SUCCESSFUL SAVE IS NOT A FAILURE, however dirty the editor stays", async () => {
    /**
     * The near-miss in the first fix. Editors catch their own errors and report them through the
     * status line, so the promise resolves either way - counting every attempt would have stood
     * autosave down after three ordinary saves during ordinary typing.
     */
    const h = await mount(async () => true);
    await h.render(true);
    await settle();
    expect(h.saves()).toBe(1);
    expect(h.status().stalled).toBe(false);
    await h.unmount();
  }, 20_000);

  test("a save that THROWS counts as a failure", async () => {
    // An editor with no error handling of its own must not silently stop saving either.
    const h = await mount(async () => { throw new Error("disk full"); });
    await h.render(true);
    await settle(8_000, () => h.status().stalled);
    expect(h.saves()).toBe(AUTOSAVE_TRIES);
    await h.unmount();
  }, 20_000);

  test("RETRY GIVES THE TRIES BACK, which is how the conflict bar releases it", async () => {
    let ok = false;
    const h = await mount(async () => ok);
    await h.render(true);
    await settle(8_000, () => h.status().stalled);
    expect(h.saves()).toBe(AUTOSAVE_TRIES);

    ok = true;
    await act(async () => { h.status().retry(); });
    await settle(1_000, () => h.saves() > AUTOSAVE_TRIES);
    expect(h.saves()).toBe(AUTOSAVE_TRIES + 1);
    expect(h.status().stalled).toBe(false);
    await h.unmount();
  }, 30_000);

  test("a clean editor never saves at all", async () => {
    const h = await mount(async () => true);
    await settle(1_000);
    expect(h.saves()).toBe(0);
    await h.unmount();
  }, 20_000);
});
