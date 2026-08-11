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
  /**
   * Silence a fallback path that cannot happen in a browser.
   *
   * Because react-dom decided at import time that it could not use `input` events (see the file
   * header), focusing a field sends it down `handleEventsForInputEventPolyfill`, which calls
   * `attachEvent` - an Internet Explorer API JSDOM rightly does not implement, so it throws a stack
   * into the test output on every insert. Every browser since IE9 supports `input` events, so this
   * path is unreachable in the artifact users get.
   *
   * No-ops rather than a working shim: the polyfill exists to synthesise change events we are not
   * asserting on, and pretending to implement it would be inventing behaviour to test against.
   * This repairs the harness's noise; it does not change what the app does.
   */
  const proto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["attachEvent"] ??= () => undefined;
  proto["detachEvent"] ??= () => undefined;

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

  test("offers no Hoplight platform, because Hoplight runs no macros", async () => {
    const flushSync = await mountLab();
    // It was a button showing RoleCall's macro list under a name with no engine behind it.
    expect(byText("Hoplight")).toBeUndefined();
    for (const real of ["RoleCall", "SillyTavern", "Marinara", "Lumiverse"]) {
      expect(byText(real)).toBeDefined();
    }
    unmountLab(flushSync);
  });

  test("the macro bible lists this platform's own macros and inserts one on click", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("Macro bible")!);

    const box = host.querySelector("textarea") as HTMLTextAreaElement;
    const before = box.value;
    expect(bodyText()).toContain("macros");

    // Open a group, then insert the first macro in it. Clicks are the one interaction this harness
    // delivers reliably; the caret arithmetic itself is proven in lab-core.test.ts.
    const group = buttons().find((b) => (b.textContent ?? "").includes("Identity"))
      ?? buttons().find((b) => b.className.includes("groupHead"));
    expect(group).toBeDefined();
    await press(flushSync, group!);

    const pill = buttons().find((b) => (b.textContent ?? "").startsWith("{{"));
    expect(pill).toBeDefined();
    await press(flushSync, pill!);

    const box2 = host.querySelector("textarea") as HTMLTextAreaElement;
    expect(box2.value).not.toBe(before);
    expect(box2.value).toContain(pill!.textContent!);
    unmountLab(flushSync);
  });

  test("the operations table shows the gaps, not only what exists", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("Operations")!);

    const text = bodyText();
    // A blank cell reads as "not filled in yet"; the word is the finding.
    expect(text).toContain("none");
    expect(text).toContain("with gaps");
    // Every platform gets a column, so a gap cannot be mistaken for a missing engine.
    for (const lens of ["RoleCall", "SillyTavern", "Marinara", "Lumiverse"]) {
      expect(host.querySelectorAll("th")).not.toHaveLength(0);
      expect(text).toContain(lens);
    }
    unmountLab(flushSync);
  });

  test("switching platform does not throw the reference away", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("Macro bible")!);
    await press(flushSync, byText("Marinara")!);
    // Still on the bible, now Marinara's. Kicking somebody back to Reading for changing platform
    // would undo the comparison they are in the middle of making.
    expect(bodyText()).toContain("Macro bible");
    expect(bodyText()).toContain("Marinara's own");
    unmountLab(flushSync);
  });

  test("RisuAI is on the strip, and its bible works with no checkout of anything", async () => {
    engines = [];
    const flushSync = await mountLab();
    await press(flushSync, byText("RisuAI")!);
    await press(flushSync, byText("Macro bible")!);
    // The whole point of a library: it answers on a machine with no engines installed at all.
    expect(bodyText()).toContain("macros");
    expect(bodyText()).toContain("RisuAI's own");
    unmountLab(flushSync);
  });

  test("RisuAI cannot be resolved, and the reading says why it cannot travel either", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("RisuAI")!);

    // No engine adapter for it, so the button is off with a reason - same as any lens without one.
    expect(byText("Resolve for real")!.disabled).toBe(true);
    // And the absence of travel answers is explained rather than shown as an empty list.
    expect(bodyText()).toContain("operation annotations");
    expect(byText("Where else does it work")).toBeUndefined();
    unmountLab(flushSync);
  });

  test("the operations table names the platform it has no column for", async () => {
    const flushSync = await mountLab();
    await press(flushSync, byText("Operations")!);
    // Silently omitting RisuAI would read as "that platform has nothing to say here".
    expect(bodyText()).toContain("RisuAI has no column here");
    unmountLab(flushSync);
  });
});
