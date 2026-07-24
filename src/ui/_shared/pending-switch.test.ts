/** Tests for the restart-outcome reducer: success/failed/none across bare-vs-v-prefixed, expiry, aliens. */
import { describe, expect, test } from "bun:test";
import {
  PENDING_SWITCH_TTL_MS,
  readPendingSwitch,
  reducePendingSwitch,
  type PendingSwitch,
} from "./pending-switch";

const marker = (from: string, to: string, at = 1000): PendingSwitch => ({ from, to, at });

describe("readPendingSwitch", () => {
  test("reads a well-formed marker; rejects junk/partials", () => {
    expect(readPendingSwitch({ from: "v0.1.8", to: "v0.1.9", at: 5 })).toEqual({
      from: "v0.1.8",
      to: "v0.1.9",
      at: 5,
    });
    expect(readPendingSwitch(null)).toBeNull();
    expect(readPendingSwitch({ from: "v0.1.8" })).toBeNull(); // missing to/at
    expect(readPendingSwitch({ from: "v0.1.8", to: "v0.1.9", at: 0 })).toBeNull();
  });
});

describe("reducePendingSwitch", () => {
  test("no marker -> none", () => {
    expect(reducePendingSwitch(null, "0.1.9", 2000)).toEqual({ kind: "none" });
  });
  test("booted on the target (bare vs v-prefixed) -> success", () => {
    // marker.to is "v0.1.9", the app boots reporting bare "0.1.9": still a success
    expect(reducePendingSwitch(marker("v0.1.8", "v0.1.9"), "0.1.9", 1500)).toEqual({
      kind: "success",
      from: "v0.1.8",
      to: "v0.1.9",
    });
  });
  test("booted still on the source -> failed (nothing changed)", () => {
    expect(reducePendingSwitch(marker("v0.1.8", "v0.1.9"), "0.1.8", 1500)).toEqual({
      kind: "failed",
      from: "v0.1.8",
      to: "v0.1.9",
    });
  });
  test("booted on a third version -> none (alien marker)", () => {
    expect(reducePendingSwitch(marker("v0.1.8", "v0.1.9"), "0.2.0", 1500)).toEqual({ kind: "none" });
  });
  test("expired marker -> none (a stale switch from long ago)", () => {
    const at = 1000;
    expect(reducePendingSwitch(marker("v0.1.8", "v0.1.9", at), "0.1.9", at + PENDING_SWITCH_TTL_MS + 1)).toEqual(
      { kind: "none" },
    );
  });
});
