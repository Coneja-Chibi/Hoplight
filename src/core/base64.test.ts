/** Runtime-neutral base64 contract at text and binary boundaries. */
import { describe, expect, test } from "bun:test";
import { base64ToBytes, base64ToUtf8, bytesToBase64, utf8ToBase64 } from "./base64";

describe("base64", () => {
  test("round-trips UTF-8 without Buffer", () => {
    expect(base64ToUtf8(utf8ToBase64("Hoplight / こんにちは"))).toBe("Hoplight / こんにちは");
  });

  test("round-trips bytes across chunk boundaries", () => {
    const bytes = Uint8Array.from({ length: 0x8001 }, (_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  test("browser fallback works without a Buffer global", () => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, "Buffer");
    Object.defineProperty(globalThis, "Buffer", { value: undefined, configurable: true });
    try {
      expect(base64ToUtf8(utf8ToBase64("browser / こんにちは"))).toBe("browser / こんにちは");
      const bytes = Uint8Array.from({ length: 0x8001 }, (_, i) => i % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
      expect(() => base64ToBytes("not base64")).toThrow();
      expect(() => base64ToUtf8("not base64")).toThrow();
    } finally {
      if (prior) Object.defineProperty(globalThis, "Buffer", prior);
      else Reflect.deleteProperty(globalThis, "Buffer");
    }
  });

  test("rejects malformed base64", () => {
    expect(() => base64ToBytes("not base64")).toThrow();
    expect(() => base64ToUtf8("not base64")).toThrow();
  });
});
