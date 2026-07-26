/** Regression proof that shell context repaints cannot restart the docs room or reset its page. */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
  url: "http://127.0.0.1:8321/",
});

let root: Root;
let indexRequests = 0;
const classNames = new Proxy({}, { get: (_target, property) => String(property) });
mock.module("./styles.module.css", () => ({ default: classNames }));
mock.module("../../components/render-box/styles.module.css", () => ({ default: classNames }));

const index = {
  generated: "2026-07-20",
  count: 2,
  docs: [
    {
      id: "guide/getting-started",
      path: "docs/guide/getting-started.md",
      title: "Get started",
      audience: "user",
      summary: "Start here.",
      tags: [], related: [], anchors: [],
    },
    {
      id: "reference/ui",
      path: "docs/reference/ui.md",
      title: "Studio UI",
      audience: "dev",
      summary: "The app shell.",
      tags: [], related: [], anchors: [],
    },
  ],
};

const context = (): AppContext => ({
  prefs: { get: () => "guide/getting-started", set: () => undefined },
  setStatus: () => undefined,
} as unknown as AppContext);

beforeAll(() => {
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
    fetch: async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/docs/index") {
        indexRequests += 1;
        return Response.json(index);
      }
      if (url === "/api/docs/figures") return Response.json([]);
      const id = new URL(url, "http://127.0.0.1:8321").searchParams.get("id");
      return new Response(id === "reference/ui" ? "# Studio UI" : "# Get started");
    },
  });
});

afterAll(() => dom.window.close());

describe("DocsRoom stability", () => {
  test("keeps the selected page when AppContext identity changes", async () => {
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    const { DocsRoom } = await import("./room");
    root = createRoot(document.getElementById("root")!);
    flushSync(() => root.render(<DocsRoom ctx={context()} />));
    await new Promise((resolve) => setTimeout(resolve, 50));
    flushSync(() => undefined);

    const developerButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Developer Docs",
    )!;
    flushSync(() => developerButton.click());
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync(() => undefined);
    const uiButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Studio application & local API",
    )!;
    flushSync(() => uiButton.click());
    await new Promise((resolve) => setTimeout(resolve, 20));
    flushSync(() => undefined);
    flushSync(() => root.render(<DocsRoom ctx={context()} />));
    await new Promise((resolve) => setTimeout(resolve, 20));
    flushSync(() => undefined);

    expect(document.querySelector('button[aria-current="page"]')?.textContent).toBe("Studio application & local API");
    expect(indexRequests).toBe(1);
    flushSync(() => root.unmount());
  });
});
