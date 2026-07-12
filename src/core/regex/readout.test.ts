/**
 * Composed readout (readout.ts): a single AST parse feeds the reading, the Mode/Examples/Uses lines,
 * the token words, execution-verified example chips, and the syntax spans. Every match/near-miss is
 * asserted against the real compiled pattern (engine truth); spans must reconstruct the exact find.
 */
import { describe, expect, test } from "bun:test";
import { readoutFor } from "./readout";
import { mulberry32 } from "../lore/rng";

const rng = () => mulberry32(1234);

describe("readoutFor", () => {
  test("empty pattern yields an empty readout", () => {
    const r = readoutFor("", "", { rng: rng() });
    expect(r).toMatchObject({ reading: "", matches: [], spans: [] });
  });

  test("reading, mode, words, and uses come from the AST", () => {
    const r = readoutFor("\\b(is|did|has)\\s+it\\s+rain(ing|ed)?\\b", "i", { rng: rng(), count: 4 });
    expect(r.reading.length).toBeGreaterThan(0);
    expect(r.mode).toContain("case-insensitive");
    expect(r.words).toEqual(expect.arrayContaining(["is", "did", "has"]));
    expect(r.uses).toEqual(expect.arrayContaining(["word boundaries", "alternatives", "whitespace"]));
  });

  test("every emitted match actually matches; every near-miss actually fails", () => {
    const find = "\\b(cat|dog)\\b";
    const flags = "i";
    const r = readoutFor(find, flags, { rng: rng(), count: 5 });
    const re = new RegExp(find, flags);
    for (const m of r.matches) expect(re.test(m)).toBe(true);
    for (const miss of r.nearMisses) expect(re.test(miss)).toBe(false);
  });

  test("match chips are tidied to single spaces but still match", () => {
    const find = "\\bhi\\s+there\\b";
    const r = readoutFor(find, "i", { rng: rng(), count: 3 });
    const re = new RegExp(find, "i");
    for (const m of r.matches) {
      expect(m).not.toMatch(/\s\s|\t|\n/); // no double space / tab / newline
      expect(re.test(m)).toBe(true);
    }
  });

  test("spans reconstruct the original find and label its pieces", () => {
    const find = "\\b(cat|dog)\\b";
    const r = readoutFor(find, "i", { rng: rng() });
    expect(r.spans.map((s) => s.text).join("")).toBe(find);
    expect(r.spans.some((s) => s.kind === "anchor" && s.text === "\\b")).toBe(true);
    expect(r.spans.some((s) => s.kind === "literal" && s.text.includes("cat"))).toBe(true);
  });

  test("an unparseable pattern degrades to one neutral span, never throws", () => {
    const r = readoutFor("(", "", { rng: rng() });
    expect(r.spans).toEqual([{ text: "(", kind: "group" }]);
    expect(r.reading).toBe("");
  });
});
