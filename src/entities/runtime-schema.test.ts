/** Regression coverage for fail-closed canonical parsing at storage and HTTP boundaries. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { safeParseCanonicalEntity } from "./runtime-schema";

const character = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: "alice",
  body: {
    identity: { name: "Alice" },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  },
};

describe("canonicalEntitySchema", () => {
  test("accepts a known canonical character and preserves escrow", () => {
    const parsed = safeParseCanonicalEntity({
      ...character,
      original: { risu: { raw: { unknown: true }, unmapped: { sealed: 1 } } },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.entity.original?.risu?.unmapped?.sealed).toBe(1);
  });

  test("rejects malformed nested canonical fields", () => {
    const parsed = safeParseCanonicalEntity({
      ...character,
      body: { ...character.body, identity: { name: 42 } },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues.join(" ")).toContain("body.identity.name");
  });

  test("rejects unknown entity kinds", () => {
    expect(safeParseCanonicalEntity({ ...character, kind: "production" }).ok).toBe(false);
  });
});
