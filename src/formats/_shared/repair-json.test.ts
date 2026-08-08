/**
 * Repairs that must fire, and the far larger set that must not.
 *
 * Every test that matters here is a REFUSAL. A repair is a decision about what somebody's bytes
 * mean, taken without asking them, so one that fires on a healthy file corrupts a piece that was
 * fine - a worse outcome by far than the unreadable file the repair exists to rescue.
 */
import { describe, expect, test } from "bun:test";
import { readingsOf, unwrapDoubleEncoded, unwrapExportEnvelope } from "./repair-json";

describe("unwrapDoubleEncoded", () => {
  test("a document that is a JSON string holding a piece", () => {
    /**
     * The real case: four presets in a live studio parsed on the first try and came back as a
     * string, so every detector asked them for fields and got none. `Clean.json` was 12,203
     * characters of exactly this.
     */
    expect(unwrapDoubleEncoded('{"temperature": 1}')).toEqual({ temperature: 1 });
    expect(unwrapDoubleEncoded('[{"name":"a"}]')).toEqual([{ name: "a" }]);
  });

  test("AN ORDINARY PIECE IS NOT A STRING AND IS NEVER TOUCHED", () => {
    expect(unwrapDoubleEncoded({ temperature: 1 })).toBeNull();
    expect(unwrapDoubleEncoded([1, 2, 3])).toBeNull();
  });

  test("A STRING THAT IS NOT A PIECE STAYS A STRING", () => {
    /**
     * Without the brace check, `"7"` would be repaired into the number 7 and `"null"` into null.
     * Detectors would refuse all three anyway - but the reading handed to them would be a lie, and
     * a lie in the pipe is how a wrong piece gets written back to somebody's disk later.
     */
    expect(unwrapDoubleEncoded('"7"')).toBeNull();
    expect(unwrapDoubleEncoded("7")).toBeNull();
    expect(unwrapDoubleEncoded("null")).toBeNull();
    expect(unwrapDoubleEncoded("a prompt someone wrote")).toBeNull();
  });

  test("a string that only starts like a piece is refused, not thrown", () => {
    expect(unwrapDoubleEncoded("{not json at all")).toBeNull();
  });

  test("ONE UNWRAP, NEVER A RECURSION", () => {
    /**
     * Bounded on purpose. Nobody encodes a piece three times by accident, and unbounded unwrapping
     * is a cheap way to spend a lot of time on hostile input. Encoded text NESTED INSIDE a piece
     * stays text - a prompt that happens to hold JSON is a prompt, and parsing it would rewrite
     * somebody's content into structure they never asked for.
     */
    expect(unwrapDoubleEncoded('["{\\"a\\":1}"]')).toEqual(['{"a":1}']);
    // A third layer parses to a string that opens with a quote, and stops at the brace check.
    expect(unwrapDoubleEncoded(JSON.stringify(JSON.stringify('{"a":1}')))).toBeNull();
  });
});

describe("unwrapExportEnvelope", () => {
  test("a piece inside an exporter's wrapper", () => {
    const inner = { title: "x" };
    expect(unwrapExportEnvelope({ exportedAt: "2025-01-01", type: "preset", data: inner }))
      .toEqual({ data: inner, type: "preset" });
  });

  test("THE EXPORTER'S OWN WORD FOR THE PIECE IS CARRIED OUT, NOT DROPPED", () => {
    // Unwrapping to the payload and losing the label replaces one unreadable file with a slightly
    // more readable one.
    const got = unwrapExportEnvelope({ version: "2", type: "lorebook", data: { entries: {} } });
    expect(got?.type).toBe("lorebook");
  });

  test("A BARE `data` FIELD IS NOT AN ENVELOPE", () => {
    /**
     * The dangerous false positive. Half the payloads in this repository carry a `data` field, and
     * unwrapping those hands a detector a fragment of a piece while calling it the piece.
     */
    expect(unwrapExportEnvelope({ data: { entries: {} } })).toBeNull();
    expect(unwrapExportEnvelope({ name: "card", data: { description: "" } })).toBeNull();
  });

  test("both markers required: a timestamp without a type is not an envelope", () => {
    expect(unwrapExportEnvelope({ exportedAt: "2025-01-01", data: { a: 1 } })).toBeNull();
  });

  test("an envelope whose payload is not a record has nothing to unwrap to", () => {
    expect(unwrapExportEnvelope({ exportedAt: "x", type: "preset", data: "text" })).toBeNull();
  });
});

describe("readingsOf", () => {
  test("THE ORIGINAL IS ALWAYS FIRST", () => {
    /**
     * The whole safety property. A healthy file is detected on reading one and never meets any
     * repair; a repair that ran ahead of the plain reading would be a rewrite applied to files that
     * were never broken.
     */
    const healthy = { temperature: 1 };
    expect(readingsOf(healthy)[0]).toBe(healthy);
    expect(readingsOf(healthy)).toHaveLength(1);
  });

  test("a double-encoded envelope offers both repairs, in the order they were applied", () => {
    const piece = { temperature: 1 };
    const readings = readingsOf(JSON.stringify({ exportedAt: "x", type: "preset", data: piece }));
    expect(readings).toHaveLength(3);
    expect(readings[1]).toEqual({ exportedAt: "x", type: "preset", data: piece });
    expect(readings[2]).toEqual(piece);
  });

  test("a plain string with no piece in it yields only itself", () => {
    expect(readingsOf("just text")).toEqual(["just text"]);
  });
});
