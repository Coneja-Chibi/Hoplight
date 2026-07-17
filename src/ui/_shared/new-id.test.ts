/**
 * Collision-resistant ID helper: frozen-clock uniqueness, UUID and getRandomValues paths,
 * and a narrow residual scan so timestamp-only record IDs do not reappear under src/ui.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { __resetNewUiIdSeqForTests, newUiId, type IdEntropy } from "./new-id";

const fixedBytes = (seed: number): IdEntropy["getRandomValues"] => {
  let n = seed;
  return (arr: Uint8Array): Uint8Array => {
    for (let i = 0; i < arr.length; i++) {
      n = (n * 1664525 + 1013904223) >>> 0;
      arr[i] = n & 0xff;
    }
    return arr;
  };
};

describe("newUiId", () => {
  test("UUID path returns distinct ids under a frozen clock", () => {
    let i = 0;
    const entropy: IdEntropy = {
      randomUUID: () => `00000000-0000-4000-8000-${String(i++).padStart(12, "0")}`,
    };
    const ids = new Set<string>();
    for (let k = 0; k < 5000; k++) ids.add(newUiId("alt_", entropy));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(id.startsWith("alt_")).toBe(true);
  });

  test("getRandomValues + counter path is collision-resistant without UUID", () => {
    __resetNewUiIdSeqForTests();
    const entropy: IdEntropy = { getRandomValues: fixedBytes(42) };
    const ids = new Set<string>();
    for (let k = 0; k < 5000; k++) ids.add(newUiId("t", entropy));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(id.startsWith("t")).toBe(true);
  });

  test("throws when no secure entropy is available (never time-only)", () => {
    expect(() => newUiId("x_", {})).toThrow("new-id: no secure entropy available");
  });

  test("falls through to getRandomValues when randomUUID throws", () => {
    __resetNewUiIdSeqForTests();
    const entropy: IdEntropy = {
      randomUUID: () => {
        throw new Error("no uuid");
      },
      getRandomValues: fixedBytes(7),
    };
    const a = newUiId("p_", entropy);
    const b = newUiId("p_", entropy);
    expect(a).not.toBe(b);
    expect(a.startsWith("p_")).toBe(true);
  });
});

/** Match record-id construction that is only wall-clock based (not savedAt / debounce timestamps). */
const TIMESTAMP_ONLY_ID =
  /\bid\s*:\s*(?:`[^`]*\$\{Date\.now\(\)[^`]*`|['"][^'"]*['"]\s*\+\s*Date\.now|String\(Date\.now)/;

describe("src/ui residual: no timestamp-only record ids", () => {
  test("no id: `...${Date.now()}...` style construction remains under src/ui", () => {
    const root = join(import.meta.dir, "..");
    const hits: string[] = [];

    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (name === "node_modules" || name === "dist") continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) continue;
        const text = readFileSync(p, "utf8");
        // Allow the pattern only inside this residual-check documentation comment below.
        if (TIMESTAMP_ONLY_ID.test(text)) hits.push(p);
      }
    };
    walk(root);

    // Fixture of the banned shape (must match the regex so the guard stays live).
    const bannedFixture = "id: `x_${Date.now()}`";
    const allowedTimestampField = "savedAt: Date.now()";
    expect(TIMESTAMP_ONLY_ID.test(bannedFixture)).toBe(true);
    expect(TIMESTAMP_ONLY_ID.test(allowedTimestampField)).toBe(false);

    expect(hits).toEqual([]);
  });
});
