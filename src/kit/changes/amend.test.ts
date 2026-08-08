/**
 * Correcting a draft before it is applied.
 *
 * This exists so a nearly-right rewrite can be fixed at the gate instead of accepted and then edited
 * again. It touches the write path, so the tests are mostly about what it REFUSES: amending anything
 * that has already been authorised would change what gets written after the confirmation that
 * allowed it, which is a write behind the back of its own review.
 */
import { describe, expect, test } from "bun:test";
import { createChangeSession } from "./session";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";

/** A complete preset, because the draft store parses what it is given rather than trusting it. */
const entity = (content: string): ParsedCanonicalEntity =>
  ({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "preset",
    id: "astrolabe",
    body: {
      name: "Astrolabe",
      prompts: [{
        id: "cot", name: "CoT", content, role: "system",
        enabled: true, systemPrompt: true, marker: false, placement: "relative",
        injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
      }],
    },
  }) as unknown as ParsedCanonicalEntity;

const operation = {
  capabilityId: "test",
  input: {},
  changes: [{ path: "body.prompts", label: "update", before: null, after: null }],
  warnings: [],
  platformImpact: [],
};

const staged = () => {
  const changes = createChangeSession();
  const draft = changes.create(entity("the model's wording"), operation as never);
  return { changes, draft };
};

const contentOf = (e: ParsedCanonicalEntity): string =>
  ((e.body as { prompts: { content: string }[] }).prompts[0]?.content ?? "");

describe("amend", () => {
  test("it replaces what a pending draft proposes", () => {
    const { changes, draft } = staged();
    const next = changes.amend(draft.id, entity("my wording"));
    expect(next).not.toBeNull();
    expect(contentOf(next!.proposed)).toBe("my wording");
  });

  test("the amended text is what a later read sees", () => {
    // The draft is what the revision check and the receipt are both built from, so it has to stick.
    const { changes, draft } = staged();
    changes.amend(draft.id, entity("my wording"));
    expect(contentOf(changes.get(draft.id)!.proposed)).toBe("my wording");
  });

  test("the baseline is untouched, so the diff still knows what was stored", () => {
    const { changes, draft } = staged();
    const before = contentOf(draft.baseline);
    changes.amend(draft.id, entity("my wording"));
    expect(contentOf(changes.get(draft.id)!.baseline)).toBe(before);
  });

  test("NOT ONCE IT IS APPLYING", () => {
    /**
     * The property that matters. Past this point the gate has already agreed to something; changing
     * it now would write text nobody reviewed under a confirmation given for different text.
     */
    const { changes, draft } = staged();
    changes.startApply(draft.id);
    expect(changes.amend(draft.id, entity("too late"))).toBeNull();
  });

  test("not once it is discarded", () => {
    const { changes, draft } = staged();
    changes.discard(draft.id);
    expect(changes.amend(draft.id, entity("too late"))).toBeNull();
  });

  test("an unknown draft is refused rather than created", () => {
    const { changes } = staged();
    expect(changes.amend("no-such-draft", entity("x"))).toBeNull();
  });

  test("THE TARGET CANNOT MOVE", () => {
    // Amending is correcting a wording, not redirecting the write to a different piece.
    const { changes, draft } = staged();
    const elsewhere = { ...entity("x"), id: "paramnesia" } as ParsedCanonicalEntity;
    expect(changes.amend(draft.id, elsewhere)).toBeNull();
    expect(contentOf(changes.get(draft.id)!.proposed)).toBe("the model's wording");
  });

  test("a malformed entity is refused, not stored", () => {
    // It came from a person typing into a box, so it is parsed again rather than trusted.
    const { changes, draft } = staged();
    expect(() => changes.amend(draft.id, { nope: true } as unknown as ParsedCanonicalEntity)).toThrow();
    expect(contentOf(changes.get(draft.id)!.proposed)).toBe("the model's wording");
  });
});
