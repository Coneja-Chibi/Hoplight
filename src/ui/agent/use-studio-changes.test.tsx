/**
 * When an open editor is allowed to re-read itself.
 *
 * DRIVEN THROUGH A REAL MOUNT, and the reason is a bug the old version of this file could not have
 * caught. It asserted a copy of the rule written out in the test, which agreed with the hook and
 * was still wrong about the behaviour: the rule says a dirty piece is re-read LATER, and the hook
 * dropped the change on the floor instead. The predicate was right about every case and the code
 * only ran once. Nothing short of mounting it and letting time pass distinguishes the two.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useReopenOnStudioChange } from "./use-studio-changes";

let dom: JSDOM;

/** Every source the hook has opened, so a test can push frames at it. */
const live: FakeSource[] = [];

type Listener = (event: MessageEvent<string>) => void;

/** The stream, without a server. Only the three events the hook listens for. */
class FakeSource {
  private readonly listeners = new Map<string, Listener[]>();
  constructor(readonly url: string) { live.push(this); }
  addEventListener(type: string, fn: Listener): void {
    const at = this.listeners.get(type) ?? [];
    at.push(fn);
    this.listeners.set(type, at);
  }
  close(): void { /* nothing to tear down */ }
  emit(type: string, data?: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) {
      fn({ data: JSON.stringify(data ?? {}) } as MessageEvent<string>);
    }
  }
}

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    Element: dom.window.Element,
    EventSource: FakeSource,
    /**
     * ACT, NOT flushSync. The behaviour under test is a CASCADE - an effect that records the debt,
     * then a second effect that pays it - and flushSync only flushes the render in front of it.
     * With it, every clean-path assertion read zero while the hook was working perfectly.
     */
    IS_REACT_ACT_ENVIRONMENT: true,
  });
});

afterAll(() => dom.window.close());

const PIECE = { id: "astrolabe", kind: "preset" };

interface Harness {
  /** How many times the room was told to re-read. */
  reopens: () => number;
  /** Re-render with a different dirty flag, the way the room does when the editor reports one. */
  setDirty: (next: boolean) => Promise<void>;
  /** Push a change burst down the stream. */
  change: (kinds: readonly string[]) => Promise<void>;
  /** Wrapped, because React counts the unmount itself as an update. */
  unmount: () => Promise<void>;
}

async function mount(piece = PIECE, startDirty = false): Promise<Harness> {
  live.length = 0;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  let count = 0;

  function Probe({ dirty }: { dirty: boolean }): null {
    useReopenOnStudioChange(piece, dirty, () => { count += 1; });
    return null;
  }

  const harness: Harness = {
    reopens: () => count,
    unmount: async () => { await act(async () => { root.unmount(); }); },
    setDirty: async (next) => { await act(async () => { root.render(<Probe dirty={next} />); }); },
    change: async (kinds) => {
      await act(async () => { for (const s of live) s.emit("changed", { kinds }); });
    },
  };
  await act(async () => { root.render(<Probe dirty={startDirty} />); });
  // The stream reports it is up before it reports anything else; the hook counts that as no change.
  await act(async () => { for (const s of live) s.emit("ready"); });
  return harness;
}

describe("re-reading an open piece", () => {
  test("a clean piece re-reads when its own deck changed", async () => {
    const h = await mount();
    await h.change(["preset"]);
    expect(h.reopens()).toBe(1);
    await h.unmount();
  });

  test("A DIRTY PIECE IS NEVER RE-READ UNDERNEATH THE PERSON EDITING IT", async () => {
    /**
     * Kit's rail settled this first: a stale view is an annoyance, losing a rearrange is not.
     */
    const h = await mount(PIECE, true);
    await h.change(["preset"]);
    expect(h.reopens()).toBe(0);
    await h.unmount();
  });

  test("DECLINING IS NOT DISCARDING: it lands the moment the edits are saved", async () => {
    /**
     * THE REGRESSION THIS FILE EXISTS FOR. The change arrived once, was declined once, and was then
     * gone - the version does not bump twice for one write, so nothing ever re-ran the effect. The
     * room went on holding a stale entity and a stale revision for as long as the tab stayed open,
     * which is what made the editor's next save fail and kept it failing.
     */
    const h = await mount(PIECE, true);
    await h.change(["preset"]);
    expect(h.reopens()).toBe(0);
    await h.setDirty(false);
    expect(h.reopens()).toBe(1);
    await h.unmount();
  });

  test("and it lands ONCE, not once per render", async () => {
    // Re-reading on every render while clean would be a fetch and a repaint per keystroke.
    const h = await mount(PIECE, true);
    await h.change(["preset"]);
    await h.setDirty(false);
    await h.setDirty(false);
    expect(h.reopens()).toBe(1);
    await h.unmount();
  });

  test("ANOTHER DECK'S CHANGE IS IGNORED, and stays ignored", async () => {
    // Editing a preset must not re-read every open lorebook - and the debt must not be remembered
    // either, or clearing dirty later would fire a re-read nothing ever asked for.
    const h = await mount(PIECE, true);
    await h.change(["lorebook"]);
    await h.setDirty(false);
    expect(h.reopens()).toBe(0);
    await h.unmount();
  });

  test("a change with no named kinds re-reads anyway", async () => {
    // A malformed frame still means SOMETHING moved. Re-reading is the safe answer when the stream
    // could not say what; refusing would leave the bench stale on the one event it could not parse.
    const h = await mount();
    await h.change([]);
    expect(h.reopens()).toBe(1);
    await h.unmount();
  });

  test("the initial subscription is not a change", async () => {
    // The stream connects after the editor has already loaded; re-reading there doubles every open.
    const h = await mount();
    expect(h.reopens()).toBe(0);
    await h.unmount();
  });
});
