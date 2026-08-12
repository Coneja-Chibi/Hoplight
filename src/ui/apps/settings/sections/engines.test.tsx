/**
 * Settings > Studio's engine rows, as they actually mount.
 *
 * THE POINT OF THE SCREEN IS THAT IT REACHES THE SURFACE. The route is proven on its own
 * (server-macro-lab.test.ts) and the four states are proven pure (engines-core.test.ts); what is
 * left is the wiring, which is the half that was missing entirely - the engine could only ever be
 * named by an environment variable because nothing in the window ever called this endpoint.
 *
 * NOTHING HERE SIMULATES TYPING, for the reason macro-lab/room.test.tsx records at length:
 * react-dom decides once at import time whether it can use `input` events, and in this suite it
 * decides no, so `onChange` never fires for a text field. Clicks do work. The field's contents
 * therefore come from the server's own answer, which is the case that matters anyway - somebody
 * pressing Save on a folder that is already saved must not be told it is bad.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";

const dom = new JSDOM(
  "<!doctype html><html><head><meta name='vaude-session' content='test-token'></head>"
  + "<body><div id='root'></div></body></html>",
  { url: "http://127.0.0.1:8321/" },
);

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./engines.module.css", () => ({ default: classNames }));
mock.module("../styles.module.css", () => ({ default: classNames }));

interface Row {
  id: string;
  label: string;
  install: string;
  rootVar: string;
  saved: string;
  env: string;
  root: string;
  from: "env" | "saved" | null;
}

const stRow = (over: Partial<Row> = {}): Row => ({
  id: "sillytavern",
  label: "SillyTavern",
  install: "a SillyTavern checkout",
  rootVar: "HOPLIGHT_ST_ROOT",
  saved: "",
  env: "",
  root: "",
  from: null,
  ...over,
});

let rows: Row[] = [];
let calls: { path: string; method: string; body: unknown }[] = [];
let root: Root;
let host: HTMLElement;

/** The real apiFetchJson runs; only the network under it is answered here. */
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
    fetch: async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null;
      calls.push({ path, method, body });
      if (method === "POST") {
        // The route answers a save with the whole table; the screen must take its word for it
        // rather than keeping the value it just sent.
        const asked = body as { engine: string; root: string };
        rows = rows.map((r) =>
          r.id === asked.engine
            ? { ...r, saved: asked.root, root: asked.root, from: asked.root ? "saved" : null }
            : r,
        );
      }
      return new Response(JSON.stringify({ engines: rows }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as unknown as Response;
    },
  });
};

beforeAll(installGlobals);
afterAll(() => dom.window.close());

beforeEach(() => {
  installGlobals();
  calls = [];
  rows = [stRow()];
});

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll("button")];
const byText = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? "").includes(text));
const field = (): HTMLInputElement | null => host.querySelector("input");
const bodyText = (): string => host.textContent ?? "";

async function mountRows(): Promise<typeof import("react-dom")["flushSync"]> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { EngineRoots } = await import("./engines");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<EngineRoots />));
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
  return flushSync;
}

function unmountRows(flushSync: Awaited<ReturnType<typeof mountRows>>): void {
  flushSync(() => root.unmount());
  host.remove();
}

const press = async (
  flushSync: Awaited<ReturnType<typeof mountRows>>,
  button: HTMLButtonElement,
): Promise<void> => {
  flushSync(() => button.click());
  await new Promise((r) => setTimeout(r, 30));
  flushSync(() => undefined);
};

describe("the engine rows in Settings", () => {
  test("asks the host what it has, and offers a field for an engine it does not", async () => {
    const flushSync = await mountRows();
    expect(calls[0]).toMatchObject({ path: "/api/macro-lab/roots", method: "GET" });
    expect(bodyText()).toContain("SillyTavern");
    expect(bodyText()).toContain("not set");
    expect(field()?.disabled).toBe(false);
    unmountRows(flushSync);
  });

  test("Save sends the folder to the host-only surface and takes the answer back", async () => {
    rows = [stRow({ saved: "C:\\ST", root: "C:\\ST", from: "saved" })];
    const flushSync = await mountRows();
    expect(field()?.value).toBe("C:\\ST");
    expect(bodyText()).toContain("in use");

    await press(flushSync, byText("Save")!);
    const posted = calls.find((c) => c.method === "POST");
    expect(posted).toMatchObject({
      path: "/api/macro-lab/roots",
      body: { engine: "sillytavern", root: "C:\\ST" },
    });
    expect(bodyText()).toContain("saved");
    unmountRows(flushSync);
  });

  test("Clear is offered only for a folder there is one of, and empties it", async () => {
    rows = [stRow({ saved: "C:\\ST", root: "C:\\ST", from: "saved" })];
    const flushSync = await mountRows();
    await press(flushSync, byText("Clear")!);
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      engine: "sillytavern",
      root: "",
    });
    // The row is still there - the engine did not stop existing, it stopped being pointed at.
    expect(bodyText()).toContain("SillyTavern");
    expect(byText("Clear")).toBeUndefined();
    unmountRows(flushSync);
  });

  test("a variable in force locks the field and names the folder actually in use", async () => {
    rows = [stRow({ saved: "C:\\Saved", env: "C:\\FromVar", root: "C:\\FromVar", from: "env" })];
    const flushSync = await mountRows();
    // Editable would be a lie: this run is not using what the box says, and saving would not
    // change what it uses.
    expect(field()?.disabled).toBe(true);
    expect(byText("Save")?.disabled).toBe(true);
    expect(bodyText()).toContain("HOPLIGHT_ST_ROOT");
    expect(bodyText()).toContain("C:\\FromVar");
    unmountRows(flushSync);
  });

  test("a refusal from the host is shown as itself, not swallowed into silence", async () => {
    const flushSync = await mountRows();
    Object.assign(globalThis, {
      fetch: async () =>
        new Response(JSON.stringify({ error: "no macro-system.js in there" }), {
          status: 422,
          headers: { "content-type": "application/json" },
        }) as unknown as Response,
    });
    await press(flushSync, byText("Save")!);
    expect(bodyText()).toContain("no macro-system.js in there");
    unmountRows(flushSync);
  });

  /**
   * IN THE TAB, not merely in a file. Every assertion above would pass just as well for a component
   * nothing renders - which is the exact shape of the gap being closed here, a working surface with
   * no way into it. This mounts the Studio section the registry actually serves.
   */
  test("the rows are in the Studio tab, reached the way Settings reaches them", async () => {
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    const { settingsSections } = await import("./registry");
    const studio = settingsSections().find((s) => s.id === "studio");
    expect(studio).toBeDefined();

    const ctx = {
      setStatus: () => undefined,
      apps: () => [],
      prefs: { get: () => undefined, set: () => undefined },
      api: { formats: async () => [] },
    } as unknown as Parameters<NonNullable<typeof studio>["Component"]>[0]["ctx"];

    host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    const Section = studio!.Component;
    flushSync(() => root.render(<Section ctx={ctx} />));
    await new Promise((r) => setTimeout(r, 30));
    flushSync(() => undefined);

    expect(calls.some((c) => c.path === "/api/macro-lab/roots")).toBe(true);
    expect(bodyText()).toContain("SillyTavern");
    unmountRows(flushSync);
  });

  test("a studio whose server has no such surface simply shows no rows", async () => {
    Object.assign(globalThis, {
      fetch: async () => new Response("nope", { status: 404 }) as unknown as Response,
    });
    const flushSync = await mountRows();
    // An older server behind a newer window is not worth an error banner over the rest of Settings.
    expect(host.querySelector("input")).toBeNull();
    unmountRows(flushSync);
  });
});
