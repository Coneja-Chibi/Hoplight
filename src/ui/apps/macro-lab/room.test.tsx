/**
 * The Macro Lab as it actually mounts.
 *
 * WHY A RENDER TEST AND NOT ONLY THE PURE ONES. The two halves of this app are each proven on their
 * own - lab-core against the catalogs, the route against real engines - and the failures that get
 * past both live exactly here, in the wiring. The one that cost a full evening on the editor's
 * conflict bar was of this shape: a check that read false in the browser forever while every unit
 * test passed, because each app is bundled separately and `instanceof` across chunks is never true.
 *
 * So these assert the app's PROMISES rather than its markup: a lens with no engine cannot be
 * resolved and says why, a refusal reads as a refusal, and a stale answer never survives a change.
 *
 * NOTHING HERE SIMULATES TYPING, and that is a harness limit worth stating rather than working
 * around quietly. react-dom decides ONCE, at module-import time, whether it can use `input` events;
 * in this suite it is first imported before any document exists, so it permanently takes the other
 * path and `onChange` never fires for a text field no matter which globals are installed afterwards.
 * `onInput` still fires, and clicks still work, which is what makes it look like an app bug - two
 * assertions here passed alone and failed in the full run on exactly this. The rules a keystroke
 * would have exercised live in buildResolveAsk and are proven directly in lab-core.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext, MacroResolveAsk, MacroResolveResult } from "../../app-contract";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://127.0.0.1:8321/",
});

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./styles.module.css", () => ({ default: classNames }));
mock.module("../../components/stamp/styles.module.css", () => ({ default: classNames }));

let root: Root;
let asked: MacroResolveAsk[] = [];
let engines: { id: string; label: string }[] = [];
let reply: MacroResolveResult | Error = { ok: false, reason: "no-renderer", detail: "not set" };

/** Set to make the availability call throw, which is a different fact from "none installed". */
let enginesFail: Error | null = null;

const context = (): AppContext => ({
  setStatus: () => undefined,
  api: {
    macroEngines: async () => {
      if (enginesFail) throw enginesFail;
      return { engines };
    },
    macroResolve: async (ask: MacroResolveAsk) => {
      asked.push(ask);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  },
} as unknown as AppContext);

/**
 * The container this mount owns.
 *
 * ITS OWN NODE PER TEST, not a shared #root. Handing the same element to createRoot twice is a React
 * warning today and a stale tree tomorrow, and a lab whose second test reads the first one's output
 * proves nothing.
 */
let host: HTMLElement;

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const byText = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? "").includes(text));
const bodyText = (): string => host.textContent ?? "";


/**
 * Point the globals at THIS file's DOM.
 *
 * RE-ASSERTED BEFORE EVERY TEST, AND WHOLE. The suite runs in one process and several component
 * test files each install their own JSDOM over the same globals, so a beforeAll here is only correct
 * until the next such file runs. Worse, a PARTIAL set is the trap: shell/dock-chord.test.tsx
 * installs its own `Element` and `Node` and this file left those alone, so React was type-checking
 * this DOM's nodes against another DOM's constructors. Rendering still looked perfect - React only
 * mutates nodes to do that - while the onChange path bailed out silently, so typing reached nothing
 * and the component appeared not to react. Clicks kept working, which is what made it look like an
 * app bug. Two tests passed alone and failed in the full run on exactly this.
 *
 * Anything another file in this suite claims, claim back.
 */
const installGlobals = (): void => {
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    SVGElement: dom.window.SVGElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    DOMParser: dom.window.DOMParser,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  });
};

beforeAll(installGlobals);

afterAll(() => dom.window.close());

beforeEach(() => {
  installGlobals();
  asked = [];
  enginesFail = null;
  engines = [{ id: "sillytavern", label: "SillyTavern" }];
});

/** Mount fresh into a container of this test's own, and let the engine list settle. */
async function mountLab(): Promise<typeof import("react-dom")["flushSync"]> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { MacroLab } = await import("./index");
  // This file's own document by name, never the ambient global: see installGlobals.
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<MacroLab ctx={context()} />));
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
  return flushSync;
}

/** Unmount and take the container with it, so nothing a test rendered outlives it. */
function unmountLab(flushSync: Awaited<ReturnType<typeof mountLab>>): void {
  flushSync(() => root.unmount());
  host.remove();
}

const press = async (
  flushSync: Awaited<ReturnType<typeof mountLab>>,
  button: HTMLButtonElement,
): Promise<void> => {
  flushSync(() => button.click());
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
};

describe("Macro Lab", () => {
  test("reads the starter text against the catalog with no engine call at all", async () => {
    const flushSync = await mountLab();
    // The reading half is pure and local: it must be on screen before anything is resolved.
    expect(bodyText()).toContain("{{char}}");
    expect(asked).toHaveLength(0);
    unmountLab(flushSync);
  });

  test("a lens with no engine here cannot be resolved, and says why rather than greying out", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("RoleCall")!);

    const resolve = byText("Resolve for real")!;
    expect(resolve.disabled).toBe(true);
    // "Disabled" alone reads as broken. The reason has to be on screen next to it.
    expect(bodyText()).toContain("No RoleCall engine on this machine");
    unmountLab(flushSync);
  });

  test("resolving asks the engine behind the chosen lens, and shows what it said", async () => {
    reply = {
      ok: true,
      prompt: "Hello Seraphina",
      unresolved: [],
      warnings: [],
      engine: { name: "sillytavern", version: "1.18.0" },
    };
    const flushSync = await mountLab();
    await press(flushSync, byText("Resolve for real")!);

    expect(asked).toHaveLength(1);
    expect(asked[0]!.engine).toBe("sillytavern");
    expect(asked[0]!.text).toContain("{{char}}");
    expect(bodyText()).toContain("Hello Seraphina");
    // The build that answered is named, because a stale engine is this feature's worst failure.
    expect(bodyText()).toContain("1.18.0");
    unmountLab(flushSync);
  });

  test("the pretend-context fields are on screen for a person to fill in", async () => {
    // What they DO once filled is buildResolveAsk's contract and is proven there; that they exist
    // and are labelled by the macro they answer for is this screen's job.
    const flushSync = await mountLab();
    expect(host.querySelector("#macro-lab-user")).not.toBeNull();
    expect(host.querySelector("#macro-lab-char")).not.toBeNull();
    expect(bodyText()).toContain("{{char}} is");
    unmountLab(flushSync);
  });

  /**
   * THE ONE THAT MATTERS MOST. "The engine finished and found nothing unresolved" and "the engine
   * never answered" must never look the same. A refusal rendered as an empty output box would read
   * on screen as a clean pass, which is the exact false positive the render contract was built to
   * make impossible.
   */
  test("a refusal is printed as a refusal, never as an empty clean result", async () => {
    reply = { ok: false, reason: "engine-error", detail: "the renderer exited 1" };
    const flushSync = await mountLab();
    await press(flushSync, byText("Resolve for real")!);

    const text = bodyText();
    expect(text).toContain("did not finish");
    expect(text).toContain("the renderer exited 1");
    expect(text).toContain("do not read this as a pass");
    expect(text).not.toContain("Every macro resolved");
    unmountLab(flushSync);
  });

  test("reports what survived the engine, so the person sees what the model would", async () => {
    reply = {
      ok: true,
      prompt: "Dead {{nope}}",
      unresolved: [{ token: "{{nope}}", count: 2 }],
      warnings: [],
      engine: { name: "sillytavern", version: "1.18.0" },
    };
    const flushSync = await mountLab();
    await press(flushSync, byText("Resolve for real")!);

    expect(bodyText()).toContain("{{nope}} ×2");
    expect(bodyText()).not.toContain("Every macro resolved");
    unmountLab(flushSync);
  });

  test("an answer does not outlive the question it answered", async () => {
    reply = {
      ok: true,
      prompt: "Hello Character",
      unresolved: [],
      warnings: [],
      engine: { name: "sillytavern", version: "1.18.0" },
    };
    engines = [
      { id: "sillytavern", label: "SillyTavern" },
      { id: "marinara", label: "Marinara" },
    ];
    const flushSync = await mountLab();
    await press(flushSync, byText("Resolve for real")!);
    expect(bodyText()).toContain("Hello Character");

    // Switch to another engine's lens. Leaving SillyTavern's answer on screen under Marinara's
    // heading is the same lie as resolving on a keystroke, told more slowly.
    await press(flushSync, byText("Marinara")!);
    expect(bodyText()).not.toContain("Hello Character");
    unmountLab(flushSync);
  });

  test("a machine with no engines at all can still read, and says why it cannot resolve", async () => {
    engines = [];
    const flushSync = await mountLab();
    expect(byText("Resolve for real")!.disabled).toBe(true);
    expect(bodyText()).toContain("No SillyTavern engine on this machine");
    // The catalog half is the whole point of it degrading rather than disappearing.
    expect(bodyText()).toContain("{{char}}");
    unmountLab(flushSync);
  });

  test("an unreachable studio says so, instead of looking like a missing feature", async () => {
    // A THROW, not an empty list. "Nothing is installed" and "nobody could be asked" are different
    // facts and the second one is not the user's to fix by installing anything.
    enginesFail = new Error("network down");
    const flushSync = await mountLab();
    expect(bodyText()).toContain("Could not ask which engines are installed");
    unmountLab(flushSync);
  });

  test("the canonical lens does not claim an engine it has no runtime for", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("Hoplight")!);
    const text = bodyText();
    // "In this engine's catalog" names an engine, and Hoplight is a dialect - see macros/index.ts,
    // which is explicit that vaud has no runtime and `full` simply mirrors RoleCall's catalog.
    expect(text).not.toContain("in this engine's catalog");
    expect(text).toContain("canonical superset dialect");
    unmountLab(flushSync);
  });
});
