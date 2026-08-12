/**
 * The drawing editor's chrome, pressed rather than reasoned about.
 *
 * WHY THIS FILE EXISTS. The split arithmetic is pure and proven in htmldoc-split.test.ts, and that
 * was not enough: "Hide" was wired correctly and hid nothing, because an author's `display: flex`
 * beats the browser's own `[hidden] { display: none }` and the pane stayed in flow. Nothing pure
 * could have caught it. A click can.
 *
 * Typing is not simulated here (react-dom decides at import time that it cannot use `input` events
 * in this suite - macro-lab/room.test.tsx records the whole story), so these press buttons and read
 * what the DOM says afterwards.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext, StudioEntitySummary } from "../../app-contract";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/" });

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./htmldoc.module.css", () => ({ default: classNames }));

let root: Root;
let host: HTMLElement;
let prefs: Record<string, unknown> = {};

const installGlobals = (): void => {
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
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  });
};

beforeAll(installGlobals);
afterAll(() => dom.window.close());
beforeEach(() => { installGlobals(); prefs = {}; });

const ctx = (): AppContext => ({
  setStatus: () => undefined,
  prefs: {
    get: (key: string) => prefs[key],
    set: (key: string, value: unknown) => { prefs[key] = value; },
  },
  api: { saveEditedEntity: async () => ({ revision: "r2" }) },
  // The editor is wrapped in useEditorGuards, which reports its dirty state to the shell.
  workbench: { setDirty: () => undefined },
} as unknown as AppContext);

const piece = { id: "drawing", kind: "htmldoc", name: "A drawing" } as unknown as StudioEntitySummary;
const entity = { body: { name: "A drawing", html: "<b>hi</b>" }, original: {} };

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const byText = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? "").includes(text));
const sourcePane = (): HTMLTextAreaElement | null => host.querySelector("textarea");

async function mountEditor(): Promise<typeof import("react-dom")["flushSync"]> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { HtmlDocEditor } = await import("./htmldoc-editor");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<HtmlDocEditor entity={entity} revision="r1" ctx={ctx()} piece={piece} />));
  await new Promise((r) => setTimeout(r, 20));
  flushSync(() => undefined);
  return flushSync;
}

describe("the drawing editor's source pane", () => {
  test("Hide actually takes the pane out of the layout, and Show brings it back", async () => {
    const flushSync = await mountEditor();
    const pane = sourcePane()?.closest("div");
    expect(pane).not.toBeNull();

    flushSync(() => byText("Hide")!.click());
    // hidden on the element is the mechanism; the CSS module carries .pane[hidden]{display:none}
    // because an author's own display would otherwise win and the pane would stay in flow.
    expect(pane!.hasAttribute("hidden")).toBe(true);
    // The pane is hidden rather than unmounted, so its own Hide button is still in the tree - a
    // hidden subtree is neither drawn nor focusable, and the way back is the reveal button.
    expect(byText("Show source")).toBeDefined();

    flushSync(() => byText("Show source")!.click());
    expect(pane!.hasAttribute("hidden")).toBe(false);
    flushSync(() => root.unmount());
    host.remove();
  });

  test("the choice is remembered, so a way of working survives the next tab", async () => {
    const flushSync = await mountEditor();
    flushSync(() => byText("Hide")!.click());
    expect(prefs["workbench.htmldoc.source"]).toBe(false);
    flushSync(() => byText("Show source")!.click());
    expect(prefs["workbench.htmldoc.source"]).toBe(true);
    flushSync(() => root.unmount());
    host.remove();
  });

  /**
   * The pairing that makes the test above mean something. JSDOM applies no stylesheet, so nothing
   * mounted can observe `display: none`; and the browser's own `[hidden]` rule LOSES to an author's
   * `display: flex` on the same element. The attribute is therefore only half the mechanism - this
   * asserts the other half is in the module, which is exactly the half that was missing.
   */
  test("the stylesheet carries the rule the hidden attribute needs", async () => {
    const css = await Bun.file(
      new URL("./htmldoc.module.css", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    ).text();
    expect(css).toMatch(/\.pane\[hidden\]\s*\{[^}]*display:\s*none/);
  });

  test("the divider is a separator a keyboard can reach and move", async () => {
    const flushSync = await mountEditor();
    const grip = host.querySelector("[role=\"separator\"]") as HTMLElement | null;
    expect(grip).not.toBeNull();
    expect(grip!.getAttribute("aria-valuenow")).toBe("50");
    expect(grip!.tabIndex).toBe(0);
    flushSync(() => root.unmount());
    host.remove();
  });

  test("a remembered split is where the editor opens", async () => {
    prefs["workbench.htmldoc.split"] = 70;
    const flushSync = await mountEditor();
    const grip = host.querySelector("[role=\"separator\"]") as HTMLElement | null;
    expect(grip!.getAttribute("aria-valuenow")).toBe("70");
    flushSync(() => root.unmount());
    host.remove();
  });
});
