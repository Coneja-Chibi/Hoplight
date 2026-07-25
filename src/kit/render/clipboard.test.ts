/** Proves clipboard requests fail honestly when OSC52 is unavailable or the payload is unsafe. */
import { describe, expect, test } from "bun:test";
import { copyText, OSC52_BYTE_CAP, type ClipboardRenderer } from "./clipboard";

const renderer = (supported = true, copied = true): ClipboardRenderer => ({
  isOsc52Supported: () => supported,
  copyToClipboardOSC52: () => copied,
});

describe("copyText", () => {
  test("requests an OSC52 copy only when supported", () => {
    expect(copyText(renderer(), "hello")).toBe("requested");
    expect(copyText(renderer(false), "hello")).toBe("unsupported");
  });

  test("reports renderer refusal and oversized payloads", () => {
    expect(copyText(renderer(true, false), "hello")).toBe("failed");
    expect(copyText(renderer(), "x".repeat(OSC52_BYTE_CAP + 1))).toBe("too-large");
  });

  test("measures encoded bytes instead of JavaScript code units", () => {
    expect(copyText(renderer(), "é".repeat(Math.floor(OSC52_BYTE_CAP / 2) + 1))).toBe("too-large");
  });
});
