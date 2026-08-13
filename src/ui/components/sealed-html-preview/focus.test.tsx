/**
 * THE FRAME MUST NOT KEEP THE KEYBOARD.
 *
 * Reported twice as "ctrl+/ doesn't work with an html up", and reproduced in a real browser: a click
 * inside the sealed iframe focuses it, and every keystroke after that belongs to ITS document. The
 * shell's chords are `window` listeners on the parent - ctrl+/ for the agent, ctrl+1..9 for the dock -
 * so all of them go dead, and the parent cannot listen inside the frame to fix it, because
 * `sandbox=""` makes the document an opaque origin with no scripting. That is the seal working.
 *
 * The fix hands focus straight back, DEFERRED by one turn of the loop. That detail is the test: a
 * synchronous blur inside the handler does not stick, because the browser is still assigning focus
 * to the frame and puts it back. Measured in Chromium before it was written, and asserted here so a
 * later "simplification" back to a synchronous blur fails instead of silently killing the chords.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8321/" });

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./styles.module.css", () => ({ default: classNames }));

let root: Root;
let host: HTMLElement;

const installGlobals = (): void => {
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLIFrameElement: dom.window.HTMLIFrameElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
  });
};

beforeAll(installGlobals);
afterAll(() => dom.window.close());
beforeEach(installGlobals);

const frame = (): HTMLIFrameElement | null => host.querySelector("iframe");
const settle = async (): Promise<void> => { await new Promise((r) => setTimeout(r, 20)); };

async function mountPreview(): Promise<typeof import("react-dom")["flushSync"]> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { SealedHtmlPreview } = await import("./index");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<SealedHtmlPreview html="<p>a drawing</p>" title="A drawing" />));
  await settle();
  return flushSync;
}

describe("the sealed frame and the keyboard", () => {
  test("focus that lands in the frame is handed back, so the shell's chords keep working", async () => {
    const flushSync = await mountPreview();
    const iframe = frame();
    expect(iframe).not.toBeNull();

    iframe!.focus();
    expect(dom.window.document.activeElement).toBe(iframe);

    // What the browser does when the frame takes focus: the parent window blurs.
    dom.window.dispatchEvent(new dom.window.Event("blur"));

    /**
     * STILL FOCUSED IN THIS TICK, which is the assertion that matters. A synchronous blur inside the
     * handler passes every other check in this file and does nothing in a real browser, because the
     * browser is mid-assignment and puts focus straight back - the chords stay dead and JSDOM, which
     * has no such contest, cannot tell the difference. Asserting the deferral is how this file
     * notices somebody "simplifying" it away.
     */
    expect(dom.window.document.activeElement).toBe(iframe);

    await settle();
    expect(dom.window.document.activeElement).not.toBe(iframe);
    flushSync(() => root.unmount());
    host.remove();
  });

  test("a blur while focus is somewhere real never steals it", async () => {
    const flushSync = await mountPreview();
    const box = dom.window.document.createElement("input");
    dom.window.document.body.appendChild(box);
    box.focus();

    // Alt-tabbing away blurs the window too. Grabbing focus off whatever the person was typing in
    // would be a worse bug than the one being fixed.
    dom.window.dispatchEvent(new dom.window.Event("blur"));
    await settle();

    expect(dom.window.document.activeElement).toBe(box);
    box.remove();
    flushSync(() => root.unmount());
    host.remove();
  });

  test("Tab does not stop on a picture", async () => {
    const flushSync = await mountPreview();
    expect(frame()!.getAttribute("tabindex")).toBe("-1");
    flushSync(() => root.unmount());
    host.remove();
  });

  test("nothing is left listening after the preview goes away", async () => {
    const flushSync = await mountPreview();
    const iframe = frame()!;
    flushSync(() => root.unmount());
    host.remove();
    // An unmounted preview that still answered window blur would reach for a detached node on
    // every alt-tab for the rest of the session.
    dom.window.document.body.appendChild(iframe);
    iframe.focus();
    dom.window.dispatchEvent(new dom.window.Event("blur"));
    await settle();
    expect(dom.window.document.activeElement).toBe(iframe);
    iframe.remove();
  });
});
