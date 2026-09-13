/** Browser-runtime contract: API compatibility, volatile storage, and host-only refusal. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import type { DocsIndex } from "../ui/docs-types";
import { webStorage } from "../ui/_shared/web-storage";
import { installPocketRuntime } from "./runtime";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("temporary browser studio", () => {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    CustomEvent: globalThis.CustomEvent,
    data: globalThis.__HOPLIGHT_POCKET_DATA__,
  };
  let dispose: (() => void) | undefined;
  const dom = new JSDOM('<!doctype html><meta name="hoplight-runtime" content="browser">', {
    url: "https://example.test/Hoplight/",
  });

  beforeAll(() => {
    const docsIndex: DocsIndex = { generated: "test", count: 0, docs: [] };
    Object.assign(globalThis, {
      document: dom.window.document,
      window: dom.window,
      CustomEvent: dom.window.CustomEvent,
      localStorage: new MemoryStorage(),
      sessionStorage: new MemoryStorage(),
      __HOPLIGHT_POCKET_DATA__: {
        manifests: [{ id: "library" }],
        setupSteps: ["theme"],
        docsIndex,
        docFigures: [],
      },
    });
    globalThis.localStorage.setItem("native-sentinel", "untouched");
    dispose = installPocketRuntime();
  });

  afterAll(() => {
    dispose?.();
    Object.assign(globalThis, {
      document: original.document,
      window: original.window,
      localStorage: original.localStorage,
      sessionStorage: original.sessionStorage,
      CustomEvent: original.CustomEvent,
      __HOPLIGHT_POCKET_DATA__: original.data,
    });
    dom.window.close();
  });

  test("serves the editing API and starts empty after a new page load", async () => {
    webStorage("local")?.setItem("pocket-only", "one load");
    expect(globalThis.localStorage.getItem("native-sentinel")).toBe("untouched");
    expect(globalThis.localStorage.getItem("pocket-only")).toBeNull();
    expect(await (await fetch("/api/apps")).json()).toEqual([{ id: "library" }]);
    expect(await (await fetch("/api/version")).json()).toMatchObject({ mode: "browser" });

    const entity = {
      schemaVersion: "1",
      kind: "character",
      id: "test-character",
      body: {
        identity: { name: "Test Character" },
        persona: {},
        prompts: {},
        greetings: {},
        examples: {},
        media: {},
        attribution: {},
        discovery: {},
      },
    };
    const saved = await fetch("/api/studio/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entity),
    });
    expect(saved.status).toBe(200);
    expect(await (await fetch("/api/studio/list")).json()).toMatchObject([
      { id: "test-character", kind: "character", name: "Test Character" },
    ]);

    const exported = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity, targetId: "vaud-json" }),
    });
    expect(exported.status).toBe(200);
    const output = await exported.json() as { text?: string; suggestedExtension?: string };
    expect(output.suggestedExtension).toBe("json");
    expect(JSON.parse(output.text ?? "")).toMatchObject({ id: "test-character", kind: "character" });

    const inspected = await fetch("/api/inspect", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-filename": "test-character.json",
      },
      body: output.text,
    });
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toMatchObject({ ok: true, formatId: "vaud-json", kind: "character" });

    const unavailableResponse = await fetch("/api/remote/status");
    expect(unavailableResponse.status).toBe(501);
    expect(await unavailableResponse.json()).toEqual({
      error: "This control needs the installed Hoplight app and is unavailable in the temporary browser studio.",
    });

    dispose?.();
    dispose = installPocketRuntime();
    expect(webStorage("local")?.getItem("pocket-only")).toBeNull();
    expect(await (await fetch("/api/studio/list")).json()).toEqual([]);
  });
});
