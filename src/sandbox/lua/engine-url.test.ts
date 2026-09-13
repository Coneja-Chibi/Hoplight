/** Browser wasm paths retain the project prefix on both the page and its worker. */
import { describe, expect, test } from "bun:test";
import { resolveBrowserWasmUri } from "./engine";

describe("resolveBrowserWasmUri", () => {
  test("resolves from a GitHub project page", () => {
    expect(resolveBrowserWasmUri("https://coneja-chibi.github.io/Hoplight/", true)).toBe(
      "https://coneja-chibi.github.io/Hoplight/sandbox/glue.wasm",
    );
  });

  test("resolves beside its worker", () => {
    expect(resolveBrowserWasmUri("https://coneja-chibi.github.io/Hoplight/sandbox/worker.js", false)).toBe(
      "https://coneja-chibi.github.io/Hoplight/sandbox/glue.wasm",
    );
  });
});
