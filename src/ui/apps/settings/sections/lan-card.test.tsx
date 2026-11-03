/** LAN controls display a failed startup and permit an honest retry. */
import { expect, test } from "bun:test";
import type { AppContext } from "../../../app-contract";
import { JSDOM } from "jsdom";
import { LanCard } from "./lan-card";

test("Enable local access shows a startup failure and retries without claiming success", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const keys = ["window", "document", "navigator", "HTMLElement", "Element", "Node"] as const;
  const prior = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key] });
  const flushTasks = async () => { for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => setTimeout(resolve, 0)); };
  const document = dom.window.document;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const off = { on: false, code: "", url: "", fingerprint: "", pending: [], connected: [] };
  let attempts = 0;
  const ctx = { api: {
    remoteLanStatus: async () => off,
    remoteLanEnable: async () => {
      if (++attempts === 1) throw new Error("OpenSSL is unavailable. Install it before enabling local access.");
      return { ...off, on: true, code: "TEST-CODE", url: "https://fixture:8790" };
    },
  } } as unknown as AppContext;
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<LanCard ctx={ctx} hidden={false} redacted={false} />));
    await flushTasks();
    const enable = () => [...host.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Enable local access")!;
    flushSync(() => enable().click());
    await flushTasks();
    expect(attempts).toBe(1);
    expect(host.textContent).toContain("OpenSSL is unavailable");
    expect(host.textContent).not.toContain("Local access on");
    expect(enable().disabled).toBe(false);
    flushSync(() => enable().click());
    await flushTasks();
    expect(attempts).toBe(2);
    expect(host.textContent).toContain("Local access on");
    expect(host.textContent).not.toContain("OpenSSL is unavailable");
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    await flushTasks();
    dom.window.close();
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
