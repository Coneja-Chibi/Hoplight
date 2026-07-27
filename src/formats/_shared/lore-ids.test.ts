/**
 * Entry-id uniqueness across the Tavern-family importers, and the two downstream failures a
 * duplicate used to cause: a false activation verdict and a lost entry on round-trip.
 */
import { test, expect, describe } from "bun:test";
import { ensureUniqueEntryIds } from "./lore-enums";
import stLorebook from "../sillytavern/lorebook";
import { scanBook } from "../../core/lore/activation";

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

/** Two ST entries: the first has no uid (so it falls back to index "0"), the second has uid 0. */
const collidingWorldbook = () => ({
  name: "Colliding",
  scan_depth: 5,
  entries: {
    "0": { comment: "ALPHA", key: ["alpha"], content: "ALPHA BODY" },
    "1": { uid: 0, comment: "BETA", key: ["beta"], content: "BETA BODY" },
  },
});

describe("ensureUniqueEntryIds", () => {
  test("leaves already-unique ids untouched, including their order", () => {
    const input = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(ensureUniqueEntryIds(input).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  test("first claim keeps the id; later collisions are suffixed", () => {
    const got = ensureUniqueEntryIds([{ id: "x" }, { id: "x" }, { id: "x" }]);
    expect(got.map((e) => e.id)).toEqual(["x", "x-2", "x-3"]);
  });

  test("a suffix that is itself taken is skipped rather than colliding again", () => {
    const got = ensureUniqueEntryIds([{ id: "x" }, { id: "x-2" }, { id: "x" }]);
    expect(got.map((e) => e.id)).toEqual(["x", "x-2", "x-3"]);
  });

  test("preserves every other field and does not mutate the input", () => {
    const input = [{ id: "x", title: "one" }, { id: "x", title: "two" }];
    const got = ensureUniqueEntryIds(input);
    expect(got[1]).toEqual({ id: "x-2", title: "two" });
    expect(input[1]!.id).toBe("x"); // input untouched
  });

  test("is stable: the same input yields the same ids", () => {
    const run = () => ensureUniqueEntryIds([{ id: "x" }, { id: "x" }]).map((e) => e.id);
    expect(run()).toEqual(run());
  });
});

describe("ST import id collisions", () => {
  test("a sparse uid no longer collides with another entry's index fallback", () => {
    const body = stLorebook.toCanonical(asText(collidingWorldbook())).body;
    const ids = body.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("only the entry whose keyword is present fires", () => {
    const body = stLorebook.toCanonical(asText(collidingWorldbook())).body;
    const result = scanBook(body, [{ text: "alpha appears, nothing else", role: "user" }], {
      chanceMode: "always",
    });
    // Before the fix both entries shared id "0", so BETA inherited ALPHA's verdict and was
    // reported as fired with reason "key" on a keyword absent from the text.
    expect(result.fired).toHaveLength(1);
    const firedTitles = result.fired.map(
      (v) => body.entries.find((e) => e.id === v.entryId)?.title,
    );
    expect(firedTitles).toEqual(["ALPHA"]);
  });

  test("no entry is lost on round-trip", () => {
    const entity = stLorebook.toCanonical(asText(collidingWorldbook()));
    const back = JSON.parse(stLorebook.fromCanonical(entity).text ?? "");
    const comments = Object.values(back.entries).map((e) => (e as { comment: string }).comment);
    // Before the fix the two entries resolved to the same output key and ALPHA vanished.
    expect(Object.keys(back.entries)).toHaveLength(2);
    expect(comments.sort()).toEqual(["ALPHA", "BETA"]);
  });

  test("a numeric uid and its string spelling stay distinct entries", () => {
    const body = stLorebook.toCanonical(
      asText({
        name: "Mixed",
        scan_depth: 5,
        entries: {
          "0": { uid: 7, comment: "NUM", key: ["a"], content: "A" },
          "1": { uid: "7", comment: "STR", key: ["b"], content: "B" },
        },
      }),
    ).body;
    const ids = body.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
    expect(body.entries.map((e) => e.title)).toEqual(["NUM", "STR"]);
  });
});
