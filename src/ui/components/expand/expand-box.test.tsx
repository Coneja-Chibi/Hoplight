/**
 * The swap, mounted and clicked.
 *
 * expand-core.test.ts proves the caret math; this proves the caret actually CROSSES - that the range
 * read off the inline textarea lands on the one inside the sheet, and comes home again. The editor is
 * a different DOM node either side of the move, so every part of that transfer is a wiring claim a
 * pure test cannot make. Through a real DOM (the dock-chord precedent) because the restore lives in an
 * effect and the sheet lives in a portal, neither of which a static render ever produces.
 *
 * react-dom is imported AFTER the DOM globals exist, hence the awaited imports: it decides at module
 * load whether the browser supports input events, and a react-dom loaded into a DOM-less global falls
 * back to an IE polyfill that calls attachEvent on every focused controlled field. jsdom has no such
 * method, so the harness would bury each pass in listener stack traces.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { useState, type JSX } from "react";

const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
g["window"] = dom.window;
g["document"] = dom.window.document;
g["navigator"] = dom.window.navigator;
g["HTMLElement"] = dom.window.HTMLElement;
g["Element"] = dom.window.Element;
g["Node"] = dom.window.Node;
g["IS_REACT_ACT_ENVIRONMENT"] = false;

// ...and when another test file in the same run already loaded react-dom DOM-less, the awaited
// imports below get that cached copy anyway, so the polyfill needs somewhere harmless to land.
const elementProto = dom.window.HTMLElement.prototype as unknown as Record<string, unknown>;
elementProto["attachEvent"] = (): void => {};
elementProto["detachEvent"] = (): void => {};

const { flushSync } = await import("react-dom");
const { createRoot } = await import("react-dom/client");
const { ExpandTextarea } = await import("./index");

type Root = ReturnType<typeof createRoot>;

/** the call-and-response a real call site provides: the value lives in the parent, not the box. */
function Harness(): JSX.Element {
  const [value, setValue] = useState("hello world");
  return <ExpandTextarea label="Sample" value={value} onChange={(e) => setValue(e.target.value)} />;
}

let root: Root | null = null;
const doc = (): Document => dom.window.document;
const sheet = (): HTMLElement | null => doc().querySelector('[role="dialog"][aria-modal="true"]');
const sheetTa = (): HTMLTextAreaElement => sheet()!.querySelector("textarea")!;
const inlineTa = (): HTMLTextAreaElement => doc().querySelector<HTMLTextAreaElement>("#root textarea")!;
const expandBtn = (): HTMLButtonElement => doc().querySelector<HTMLButtonElement>('[aria-label="Expand Sample"]')!;
const collapseBtn = (): HTMLButtonElement => doc().querySelector<HTMLButtonElement>('[aria-label="Collapse Sample"]')!;

const click = (el: Element): void => {
  flushSync(() => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
};

/** a keydown as the browser delivers one: dispatched AT an element, so `target` is real. */
const press = (key: string, target: Element): void => {
  flushSync(() => target.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
};

beforeEach(() => {
  root?.unmount();
  const host = doc().getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  flushSync(() => root!.render(<Harness />));
});

afterEach(() => {
  root?.unmount();
  root = null;
});

test("the editor renders inline with an expand control and no sheet", () => {
  expect(inlineTa().value).toBe("hello world");
  expect(sheet()).toBeNull();
});

test("expanding carries the caret and the focus into the sheet", () => {
  const ta = inlineTa();
  ta.focus();
  ta.setSelectionRange(2, 7);

  click(expandBtn());

  expect(sheet()).not.toBeNull();
  const big = sheetTa();
  expect(big.value).toBe("hello world"); // the same value, still owned by the parent
  expect(doc().activeElement).toBe(big);
  expect([big.selectionStart, big.selectionEnd]).toEqual([2, 7]);
});

test("collapsing puts the caret back inline and the focus on the control that opened it", () => {
  inlineTa().focus();
  click(expandBtn());
  sheetTa().setSelectionRange(6, 9);

  click(collapseBtn());

  expect(sheet()).toBeNull();
  const back = inlineTa();
  expect([back.selectionStart, back.selectionEnd]).toEqual([6, 9]);
  expect(doc().activeElement).toBe(expandBtn());
});

test("Escape closes the sheet", () => {
  click(expandBtn());
  press("Escape", sheetTa());
  expect(sheet()).toBeNull();
});

test("an Escape the editor already used leaves the sheet open", () => {
  // CodeEditor's macro popover eats Escape exactly like this; dismissing it must not exit fullscreen.
  click(expandBtn());
  const big = sheetTa();
  big.addEventListener("keydown", (e) => e.preventDefault(), { once: true });

  press("Escape", big);

  expect(sheet()).not.toBeNull();
});

test("Tab cycles inside the sheet instead of leaving it", () => {
  click(expandBtn());
  const big = sheetTa();
  big.focus();

  press("Tab", big); // the editor is the last stop, so the wrap lands on the collapse control

  expect(doc().activeElement).toBe(collapseBtn());
});
