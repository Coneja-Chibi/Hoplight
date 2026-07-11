import { describe, expect, test } from "bun:test";
import { nearMisses } from "./near-miss";

describe("nearMisses", () => {
  test("prototype revivial -> revival", () => {
    const hits = nearMisses("revivial", ["revival", "powers", "embers"]);
    expect(hits[0]?.key).toBe("revival");
  });

  test("exact match excluded (distance 0)", () => {
    expect(nearMisses("revival", ["revival"])).toEqual([]);
  });

  test("threshold boundary: short words need distance 1", () => {
    // len 3 -> floor(3/4)=0 -> max(1,0)=1
    const hits = nearMisses("cat", ["bat", "caterpillar", "zz"]);
    expect(hits.some((h) => h.key === "bat")).toBe(true);
  });

  test("empty word or keys", () => {
    expect(nearMisses("", ["a"])).toEqual([]);
    expect(nearMisses("a", [])).toEqual([]);
  });

  test("max caps results", () => {
    const keys = ["abble", "aplle", "appla", "bpple", "xpple"];
    expect(nearMisses("apple", keys, 2).length).toBeLessThanOrEqual(2);
  });
});
