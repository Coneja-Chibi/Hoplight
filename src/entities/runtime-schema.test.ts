/** Regression coverage for fail-closed canonical parsing at storage and HTTP boundaries. */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { parseCanonicalEntity, safeParseCanonicalEntity } from "./runtime-schema";

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

  test("requires the raw member when an original escrow entry exists", () => {
    const parsed = safeParseCanonicalEntity({
      ...character,
      original: { risu: { unmapped: { sealed: 1 } } },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues.join(" ")).toContain("original.risu.raw");
  });

  test("keeps escrow payloads open but rejects invented original-entry structure", () => {
    const openPayload = safeParseCanonicalEntity({
      ...character,
      original: {
        risu: {
          raw: { arbitrary: { nested: ["payload"] } },
          unmapped: { future: { value: 7 } },
        },
      },
    });
    expect(openPayload.ok).toBe(true);

    const inventedEntryKey = safeParseCanonicalEntity({
      ...character,
      original: { risu: { raw: {}, inventedSibling: true } },
    });
    expect(inventedEntryKey.ok).toBe(false);
    if (!inventedEntryKey.ok) {
      expect(inventedEntryKey.issues.join(" ")).toContain("original.risu");
    }
  });

  test("rejects malformed nested canonical fields", () => {
    const parsed = safeParseCanonicalEntity({
      ...character,
      body: { ...character.body, identity: { name: 42 } },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues.join(" ")).toContain("body.identity.name");
  });

  test("rejects unknown same-version keys at envelope, body, and nested-object levels", () => {
    const bodyUnknown = safeParseCanonicalEntity({
      ...character,
      body: { ...character.body, inventedByTypo: true },
    });
    expect(bodyUnknown.ok).toBe(false);
    if (!bodyUnknown.ok) expect(bodyUnknown.issues.join(" ")).toContain("body");

    const envelopeUnknown = safeParseCanonicalEntity({
      ...character,
      inventedAtEnvelope: true,
    });
    expect(envelopeUnknown.ok).toBe(false);
    if (!envelopeUnknown.ok) expect(envelopeUnknown.issues.join(" ")).toContain("entity");

    const nestedUnknown = safeParseCanonicalEntity({
      ...character,
      body: {
        ...character.body,
        identity: { name: "Alice", inventedInIdentity: true },
      },
    });
    expect(nestedUnknown.ok).toBe(false);
    if (!nestedUnknown.ok) expect(nestedUnknown.issues.join(" ")).toContain("body.identity");
  });

  test("validates profiles against the matching body while preserving declared open bags", () => {
    const malformed = safeParseCanonicalEntity({
      ...character,
      profiles: { risu: { settings: "wrong" } },
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.issues.join(" ")).toContain("profiles.risu.settings");

    const valid = safeParseCanonicalEntity({
      ...character,
      body: {
        ...character.body,
        persona: { voice: { provider: "local", extras: { futureKnob: 7 } } },
      },
      original: { risu: { raw: { any: ["shape"] }, unmapped: { futureField: { nested: true } } } },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.entity.original?.risu?.unmapped?.futureField).toEqual({ nested: true });
    }
  });

  test("rejects unknown entity kinds", () => {
    expect(safeParseCanonicalEntity({ ...character, kind: "production" }).ok).toBe(false);
  });

  test("returns a discriminated union that narrows body types by kind", () => {
    const parsed = parseCanonicalEntity(character);
    const name = parsed.kind === "character" ? parsed.body.identity.name : parsed.body.name;
    expect(name).toBe("Alice");
  });

});
