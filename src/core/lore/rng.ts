/**
 * Injected RNG helpers for activation / Rehearsal.
 * Core never calls Math.random; the shell injects either crypto units or a seeded stream.
 */

/** Uniform [0, 1) from crypto.getRandomValues (browser / Bun). */
export function cryptoUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // 2^32 so the max value is strictly < 1
  return (buf[0] ?? 0) / 0x1_0000_0000;
}

/**
 * Mulberry32: deterministic stream for tests and "replay this seed" in Rehearsal.
 * Not for security; for reproducible chance rolls only.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fresh opaque seed for UI display (unsigned 32-bit). */
export function freshSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}
