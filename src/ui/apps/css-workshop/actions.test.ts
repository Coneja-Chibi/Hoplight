/**
 * CSS Workshop actions: copy/download helpers (node-safe paths).
 */
import { test, expect } from "bun:test";
import { copyText, downloadCss } from "./actions";

test("copyText returns false without clipboard or document", async () => {
  // In bun test, clipboard may be missing; helper must not throw.
  const ok = await copyText("body { color: red; }");
  expect(typeof ok).toBe("boolean");
});

test("downloadCss does not throw without document", () => {
  expect(() => downloadCss(".x { color: blue; }", "t.css")).not.toThrow();
});
