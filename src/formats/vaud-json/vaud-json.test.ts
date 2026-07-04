import { test, expect } from "bun:test";
import adapter from "./index";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { CanonicalCharacter } from "../../entities/character/schema";

const sample: CanonicalCharacter = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: "alice",
  body: {
    identity: { name: "Alice" },
    persona: {},
    prompts: {},
    greetings: { firstMessage: "Hi." },
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  },
};

test("round-trips a canonical character losslessly", () => {
  const out = adapter.fromCanonical(sample);
  expect(adapter.toCanonical({ text: out.text ?? "" })).toEqual(sample);
});

test("declares .json as its output extension", () => {
  expect(adapter.outputExtensions).toContain("json");
});

test("rejects malformed input at the boundary instead of passing a fake domain object downstream", () => {
  // valid JSON, wrong shape (no body) -> must throw here, not crash later
  expect(() => adapter.toCanonical({ text: JSON.stringify({ kind: "character", schemaVersion: "1" }) })).toThrow(
    "vaud-json: malformed canonical character",
  );
  // not a canonical character at all
  expect(() => adapter.toCanonical({ text: JSON.stringify({ hello: "world" }) })).toThrow(
    "vaud-json: not a canonical character",
  );
});
