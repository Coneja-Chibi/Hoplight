/**
 * Collision-resistant UI record IDs. Wall-clock time alone is never used: two adds in the same
 * millisecond must still produce distinct keys for React, update/delete routing, and serialization.
 *
 * Contract:
 * - returns a string safe for React keys and JSON serialization
 * - prefers crypto.randomUUID when available
 * - otherwise crypto.getRandomValues + a monotonic per-process counter
 * - never falls back to Date.now() alone
 * - injectable entropy for deterministic unit tests
 */

export interface IdEntropy {
  /** Prefer this when present (browser / modern runtimes). */
  randomUUID?: () => string;
  /** Fallback CSPRNG; required when randomUUID is missing or throws. */
  getRandomValues?: (arr: Uint8Array) => Uint8Array;
}

/** Monotonic per-process counter mixed into the non-UUID path so a frozen clock cannot collide. */
let seq = 0;

const bytesToHex = (bytes: Uint8Array): string => {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
};

const defaultEntropy = (): IdEntropy => {
  const c = globalThis.crypto as
    | { randomUUID?: () => string; getRandomValues?: (arr: Uint8Array) => Uint8Array }
    | undefined;
  return {
    randomUUID: c?.randomUUID?.bind(c),
    getRandomValues: c?.getRandomValues?.bind(c),
  };
};

/**
 * Build a collision-resistant id. Optional prefix is prepended as-is (e.g. "alt_", "t").
 * Throws when neither UUID nor getRandomValues is available (fail closed; never time-only).
 */
export function newUiId(prefix = "", entropy: IdEntropy = defaultEntropy()): string {
  if (typeof entropy.randomUUID === "function") {
    try {
      const id = entropy.randomUUID();
      if (typeof id === "string" && id.length > 0) return `${prefix}${id}`;
    } catch {
      // fall through to getRandomValues
    }
  }

  if (typeof entropy.getRandomValues !== "function") {
    throw new Error("new-id: no secure entropy available");
  }

  const bytes = new Uint8Array(16);
  entropy.getRandomValues(bytes);
  seq += 1;
  return `${prefix}${bytesToHex(bytes)}_${seq.toString(36)}`;
}

/** Test-only: reset the monotonic counter (does not affect UUID path). */
export function __resetNewUiIdSeqForTests(): void {
  seq = 0;
}
