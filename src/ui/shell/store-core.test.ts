import { expect, test } from "bun:test";
import { bumpRecents, keyOf, parseRecents } from "./store-core";

test("keyOf composes kind:id", () => {
  expect(keyOf("abc", "character")).toBe("character:abc");
});

test("parseRecents drops malformed input closed", () => {
  expect(parseRecents(null)).toEqual({});
  expect(parseRecents(undefined)).toEqual({});
  expect(parseRecents([1, 2, 3])).toEqual({});
  expect(parseRecents("nope")).toEqual({});
});

test("parseRecents keeps only finite-number values", () => {
  expect(parseRecents({ a: 1, b: "x", c: NaN, d: Infinity, e: 2 })).toEqual({ a: 1, e: 2 });
});

test("bumpRecents stamps the given keys at now and keeps prior entries", () => {
  const out = bumpRecents({ "character:a": 1 }, ["character:b"], 100, 10);
  expect(out).toEqual({ "character:a": 1, "character:b": 100 });
});

test("bumpRecents overwrites an existing key's timestamp", () => {
  const out = bumpRecents({ "character:a": 1 }, ["character:a"], 200, 10);
  expect(out).toEqual({ "character:a": 200 });
});

test("bumpRecents caps at the newest `cap` entries", () => {
  const existing = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, i]));
  const out = bumpRecents(existing, [], 999, 3);
  expect(Object.keys(out).sort()).toEqual(["k2", "k3", "k4"]);
});

test("bumpRecents no-ops cleanly on an empty key list", () => {
  expect(bumpRecents({ a: 1 }, [], 5, 10)).toEqual({ a: 1 });
});
