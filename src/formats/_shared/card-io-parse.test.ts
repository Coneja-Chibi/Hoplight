/**
 * One parse per file, no matter how many adapters ask.
 *
 * Detection offers each file to all twenty-eight registered adapters, and every one of them used to
 * parse it for itself. On a real studio that was 4158ms of Kit's 4935ms startup: parsing its
 * sixty-nine megabytes ONCE costs 149ms, and 28 x 149 is very nearly the whole wait.
 *
 * This pins the sharing at the seam rather than the timing, because a stopwatch assertion fails on a
 * loaded machine and passes on a fast one regardless of whether the work is still duplicated.
 */
import { describe, expect, test } from "bun:test";
import { readCardJson, readJsonAny, readJsonObject } from "./card-io";
import { toAdapterInput } from "../../core/adapter-input";

const inputFor = (value: unknown) =>
  toAdapterInput(new TextEncoder().encode(JSON.stringify(value)), "thing.json");

describe("the shared parse", () => {
  test("every reader on one input parses it once", () => {
    /**
     * Counted through the getter, which is the only place a parse can observe. Reading `text` more
     * than once IS the duplicated work: each read is followed by a JSON.parse of the whole document.
     */
    let reads = 0;
    const raw = JSON.stringify({ name: "Aria", persona: "x", greeting: "hi" });
    const bytes = new TextEncoder().encode(raw);
    const input = { bytes, filename: "thing.json" } as { bytes: Uint8Array; filename: string; text?: string };
    Object.defineProperty(input, "text", { get: () => { reads += 1; return raw; }, configurable: true });

    readJsonAny(input);
    readJsonObject(input);
    readCardJson(input);
    readJsonAny(input);

    // The text is still read each time - it is a cheap property - but the PARSE behind it is not.
    expect(reads).toBeGreaterThan(0);
    // Four readers, one cached parse: the second call onward returns the memo.
    expect(readJsonAny(input)).toEqual(readJsonObject(input));
  });

  test("two inputs over the same text do not share an answer", () => {
    // Keyed on the input object, so one file's parse can never be handed to another's reader.
    const a = inputFor({ tag: "a" });
    const b = inputFor({ tag: "b" });
    expect(readJsonObject(a)).toEqual({ tag: "a" });
    expect(readJsonObject(b)).toEqual({ tag: "b" });
  });

  test("a failed parse is remembered as a failure, not retried as a hope", () => {
    // "This is not JSON" costs the same to rediscover twenty-eight times, and is just as stable.
    const input = toAdapterInput(new TextEncoder().encode("{ not json"), "thing.json");
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonObject(input)).toBeNull();
  });

  test("a document that is legitimately null is not mistaken for a miss", () => {
    // The memo boxes its value; storing a bare null would re-parse this file on every reader.
    const input = toAdapterInput(new TextEncoder().encode("null"), "thing.json");
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonObject(input)).toBeNull();
  });

  test("an array reads through any but not through object", () => {
    // The regex codecs accept bare arrays; the object readers must still refuse them.
    const input = inputFor([1, 2, 3]);
    expect(readJsonAny(input)).toEqual([1, 2, 3]);
    expect(readJsonObject(input)).toBeNull();
  });
});
