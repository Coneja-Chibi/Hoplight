/** Downloading a helper never enables mesh access without a separate user action. */
import { expect, test } from "bun:test";
import type { AppContext } from "../../../app-contract";
import { JSDOM } from "jsdom";
function install() {
  const dom = new JSDOM("<html><body></body></html>", { url: "http://127.0.0.1:8321" });
  const previous = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "CustomEvent"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key] of previous) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: Reflect.get(dom.window, key) });
  return { dom, teardown: async () => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } dom.window.close(); } };
}
const settle = async () => { for (let i=0;i<3;i++) await Bun.sleep(0); };
test("successful Download remains off until explicit Enable", async () => {
  const installedDom = install(), document = installedDom.dom.window.document;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  const host = document.createElement("div"); document.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"), { flushSync } = await import("react-dom");
  const { default: section } = await import("./remote-access");
  let installed = false, enables = 0, downloads = 0;
  const status = () => ({ offered: true, installed, platform: "win32-x64" });
  const ctx = { api: {
    remoteStatus: async () => installed ? { phase: "off" } : { phase: "unavailable" },
    remoteHelperStatus: async () => status(),
    remoteHelperDownload: async () => { downloads++; installed = true; return status(); },
    remoteEnable: async () => { enables++; return { phase: "starting" }; },
    remoteLanStatus: async () => ({ on: false, code: "", url: "", fingerprint: "", pending: [], connected: [] }),
  } } as unknown as AppContext;
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<section.Component ctx={ctx} />)); await settle();
    const download = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Download the extra piece"));
    expect(download).toBeDefined(); flushSync(() => download!.click()); await settle();
    expect(downloads).toBe(1); expect(enables).toBe(0);
    await Bun.sleep(1550); await settle();
    const enable = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Enable remote access");
    expect(enable).toBeDefined(); flushSync(() => enable!.click()); await settle();
    expect(enables).toBe(1);
  } finally { flushSync(() => root.unmount()); host.remove(); await settle(); await installedDom.teardown(); }
});
