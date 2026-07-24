/** Tests for the LAN security core: code format, per-IP throttle, and the device approval lifecycle. */
import { describe, expect, test } from "bun:test";
import { LanHost, formatConnectCode, normalizeCode, throttleDelayMs } from "./lan-host";

describe("connect code", () => {
  test("formats into 3 groups of 3 with no ambiguous characters", () => {
    const code = formatConnectCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    expect(code).not.toMatch(/[01OIL]/); // 0/O, 1/I/L excluded so it is unmistakable
  });

  test("normalizeCode uppercases and strips separators + spaces", () => {
    expect(normalizeCode("7k4-2qf 9mx")).toBe("7K42QF9MX");
  });
});

describe("throttleDelayMs", () => {
  test("no delay at zero, exponential then capped", () => {
    expect(throttleDelayMs(0)).toBe(0);
    expect(throttleDelayMs(1)).toBe(1000);
    expect(throttleDelayMs(2)).toBe(2000);
    expect(throttleDelayMs(3)).toBe(4000);
    expect(throttleDelayMs(100)).toBe(60000);
  });
});

describe("LanHost", () => {
  const mkHost = (nowRef: { t: number }): LanHost => new LanHost({ now: () => nowRef.t });

  test("accepts the right code, rejects a wrong one", async () => {
    const now = { t: 1000 };
    const h = mkHost(now);
    const code = await h.reset();
    expect((await h.verifyCode("1.2.3.4", code)).ok).toBe(true);
    expect((await h.verifyCode("1.2.3.4", "WRONG")).ok).toBe(false);
  });

  test("throttles an IP after a failure, per-IP not global", async () => {
    const now = { t: 1000 };
    const h = mkHost(now);
    const code = await h.reset();

    const first = await h.verifyCode("1.1.1.1", "BAD1");
    expect(first.ok).toBe(false);
    expect(first.retryAfterMs).toBe(1000);

    // Same IP, still inside the window: refused with the remaining wait (right code or not).
    const during = await h.verifyCode("1.1.1.1", code);
    expect(during.ok).toBe(false);
    expect(during.retryAfterMs).toBeGreaterThan(0);

    // A DIFFERENT IP is not punished for the first IP's failures.
    expect((await h.verifyCode("2.2.2.2", code)).ok).toBe(true);

    // After the window passes, the first IP can use the right code.
    now.t += 2000;
    expect((await h.verifyCode("1.1.1.1", code)).ok).toBe(true);
  });

  test("device lifecycle: pending -> approved -> served; remove drops it", async () => {
    const now = { t: 5000 };
    const h = mkHost(now);
    await h.reset();
    const id = h.createPending("10.0.0.5", "Firefox on Android (10.0.0.5)");
    expect(h.status(id)).toBe("pending");
    expect(h.pending()).toHaveLength(1);
    expect(h.connected()).toHaveLength(0);

    h.approve(id);
    expect(h.status(id)).toBe("approved");
    expect(h.connected()).toHaveLength(1);
    expect(h.pending()).toHaveLength(0);

    h.remove(id);
    expect(h.status(id)).toBeNull();
    expect(h.connected()).toHaveLength(0);
  });

  test("reset issues a fresh code and clears sessions", async () => {
    const now = { t: 1 };
    const h = mkHost(now);
    await h.reset();
    h.createPending("x", "x");
    const next = await h.reset();
    expect(h.pending()).toHaveLength(0);
    expect(next).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  });

  test("caps pending sessions per IP so one device cannot flood the approval list", async () => {
    const now = { t: 1000 };
    const h = mkHost(now);
    await h.reset();
    for (let i = 0; i < 8; i++) h.createPending("9.9.9.9", `dev ${i}`);
    // A single IP is held to 5 pending; the oldest are evicted as new ones arrive.
    expect(h.pending().filter((s) => s.ip === "9.9.9.9")).toHaveLength(5);
  });

  test("pending sessions expire after the TTL; approved ones do not", async () => {
    const now = { t: 1000 };
    const h = mkHost(now);
    await h.reset();
    const stale = h.createPending("10.0.0.5", "stale");
    const kept = h.createPending("10.0.0.6", "kept");
    h.approve(kept);

    now.t += 16 * 60 * 1000; // past the 15-minute pending TTL
    expect(h.status(stale)).toBeNull(); // never-approved device is swept
    expect(h.status(kept)).toBe("approved"); // an approved device persists
    expect(h.pending()).toHaveLength(0);
    expect(h.connected()).toHaveLength(1);
  });
});
