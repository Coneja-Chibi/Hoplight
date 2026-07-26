/** Boundary tests for validating accumulated Kit drafts before apply. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge } from "../bridge";
import type { ChangeDraft } from "./types";
import { validateChangeDraft } from "./validate";

const character = (): ParsedCanonicalEntity => ({
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
});

const bridge = (stored: ParsedCanonicalEntity | null): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read() { return stored; },
  async save() { throw new Error("unexpected save"); },
  async delete() { return false; },
});

test("malformed optional canonical data cannot validate for apply", async () => {
  const baseline = character();
  const draft: ChangeDraft = {
    id: "draft-1",
    mode: "create",
    target: { kind: "character", id: "alice", revision: "" },
    baseline,
    proposed: {
      ...baseline,
      body: { ...baseline.body, settings: "wrong" } as never,
    },
    operations: [],
    warnings: [],
    platformImpact: [],
    status: "draft",
  };

  const result = await validateChangeDraft(draft, bridge(null));
  expect(result.canonical).toBe(false);
  expect(result.valid).toBe(false);
  expect(result.errors.join(" ")).toContain("settings");
});
