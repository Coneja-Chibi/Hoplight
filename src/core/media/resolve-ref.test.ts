import { describe, expect, test } from "bun:test";
import { resolveAssetRef } from "./resolve-ref";

describe("resolveAssetRef", () => {
  test("passes data and https", () => {
    expect(resolveAssetRef("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    expect(resolveAssetRef("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
  });

  test("fail closed on empty and ccdefault", () => {
    expect(resolveAssetRef("")).toBeNull();
    expect(resolveAssetRef("ccdefault:")).toBeNull();
    expect(resolveAssetRef("ftp://x")).toBeNull();
  });

  test("embeded:// uses asset map", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const map = { "assets/happy.png": bytes };
    const out = resolveAssetRef("embeded://assets/happy.png", map);
    expect(out?.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("missing zip path returns null", () => {
    expect(resolveAssetRef("embeded://assets/nope.png", {})).toBeNull();
  });
});
