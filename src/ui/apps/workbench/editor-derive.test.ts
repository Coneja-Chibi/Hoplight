import { expect, test } from "bun:test";
import { greetingsOf, parseScale, rec, str, strArr, tokenEstimate } from "./editor-derive";

test("parseScale keeps in-range numbers, drops the rest to 1", () => {
  expect(parseScale(1.5)).toBe(1.5);
  expect(parseScale(0.5)).toBe(0.5);
  expect(parseScale(2)).toBe(2);
  expect(parseScale(3)).toBe(1); // out of range
  expect(parseScale("x")).toBe(1); // malformed
  expect(parseScale(undefined)).toBe(1);
});

test("tolerant readers coerce anything to their type", () => {
  expect(rec({ a: 1 })).toEqual({ a: 1 });
  expect(rec(null)).toEqual({});
  expect(rec([1, 2])).toEqual({});
  expect(str("hi")).toBe("hi");
  expect(str(5)).toBe("");
  expect(strArr(["a", 1, "b", null])).toEqual(["a", "b"]);
  expect(strArr("nope")).toEqual([]);
});

test("greetingsOf reads {text,title} rows and tolerates junk", () => {
  const body = { greetings: { alt: [{ text: "hi", title: "T" }, { text: "yo" }, 5] } };
  expect(greetingsOf(body, "greetings.alt")).toEqual([
    { text: "hi", title: "T" },
    { text: "yo", title: undefined },
    { text: "", title: undefined },
  ]);
  expect(greetingsOf(body, "greetings.missing")).toEqual([]);
});

test("tokenEstimate is chars/4 across the prose fields", () => {
  const body = { identity: { description: "abcd" }, persona: { personality: "abcd" } }; // 8 chars
  expect(tokenEstimate(body)).toBe(2);
  expect(tokenEstimate({})).toBe(0);
});
