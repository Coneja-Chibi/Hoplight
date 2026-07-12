/**
 * Marinara-Engine regex adapter tests. The load-bearing part is the DETECTION FIREWALL against the
 * SillyTavern dialect: both wires carry findRegex/replaceString, so this adapter must outbid ST on
 * real Marinara dumps and score ZERO on real ST files (pinned against the ST-form
 * `_fixtures/regex/marinara-essentials.json`, which despite the name is an ST-dialect pack).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import marinaraRegex from "./index";
import sillytavernRegex from "../sillytavern/regex";

const ST_FIXTURE_TEXT = readFileSync(
  join(import.meta.dir, "../_fixtures/regex/marinara-essentials.json"),
  "utf8",
);

/** A real-shaped Marinara API dump: fixed schema, string placements, per-character targeting. */
function fixtureDump(): Record<string, unknown>[] {
  return [
    {
      id: "a1",
      name: "Strip trailing spaces",
      enabled: true,
      findRegex: "[ \\t]+$",
      replaceString: "",
      trimStrings: [],
      placement: ["ai_output"],
      flags: "gm",
      promptOnly: false,
      targetCharacterIds: [],
      order: 0,
      minDepth: null,
      maxDepth: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    },
    {
      id: "b2",
      name: "Char-scoped swap",
      enabled: false,
      findRegex: "\\bold\\b",
      replaceString: "new",
      trimStrings: ["  "],
      placement: ["user_input", "ai_output"],
      flags: "gi",
      promptOnly: true,
      targetCharacterIds: ["char-9"],
      order: 1,
      minDepth: 0,
      maxDepth: 4,
      createdAt: "",
      updatedAt: "",
    },
  ];
}

describe("detection firewall vs the SillyTavern dialect", () => {
  test("claims a Marinara dump at 0.95 and outbids ST's bid on the same file", () => {
    const text = JSON.stringify(fixtureDump());
    const mine = marinaraRegex.detect({ text });
    expect(mine).toBe(0.95);
    // ST also bids on findRegex-bearing rows; the whole point of 0.95 is winning this file.
    expect(mine).toBeGreaterThan(sillytavernRegex.detect({ text }));
  });

  test("scores ZERO on a real ST-dialect pack (scriptName rows)", () => {
    expect(marinaraRegex.detect({ text: ST_FIXTURE_TEXT })).toBe(0);
    // ...which ST itself claims, so ST files keep importing as ST.
    expect(sillytavernRegex.detect({ text: ST_FIXTURE_TEXT })).toBeGreaterThan(0);
  });

  test("refuses rows that parse but carry no Marinara-distinct signal", () => {
    const ambiguous = [{ id: "x", findRegex: "a", replaceString: "b" }];
    expect(marinaraRegex.detect({ text: JSON.stringify(ambiguous) })).toBe(0);
  });

  test("refuses empty arrays, objects, and garbage", () => {
    expect(marinaraRegex.detect({ text: "[]" })).toBe(0);
    expect(marinaraRegex.detect({ text: "{}" })).toBe(0);
    expect(marinaraRegex.detect({ text: "nope" })).toBe(0);
  });
});

describe("round trip", () => {
  test("dump file -> canonical -> dump file is deep-equal (unedited)", () => {
    const raw = fixtureDump();
    const entity = marinaraRegex.toCanonical({ text: JSON.stringify(raw), filename: "My Marinara Dump.json" });
    expect(entity.kind).toBe("regex");
    expect(entity.body.name).toBe("My Marinara Dump");
    expect(entity.body.rules.length).toBe(2);
    const out = marinaraRegex.fromCanonical(entity);
    expect(JSON.parse(out.text ?? "")).toEqual(raw);
  });

  test("field mapping spot checks (phases, targets fold, characterIds)", () => {
    const entity = marinaraRegex.toCanonical({ text: JSON.stringify(fixtureDump()) });
    const [a, b] = entity.body.rules;
    expect(a?.phases).toEqual(["output"]);
    expect(a?.targets).toBeUndefined();
    expect(b?.phases).toEqual(["input", "output"]);
    expect(b?.targets).toEqual(["prompt"]);
    expect(b?.characterIds).toEqual(["char-9"]);
    expect(b?.enabled).toBe(false);
  });
});
