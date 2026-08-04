/**
 * Post-save verification.
 *
 * The first test is the regression. Everything else guards against fixing it too hard: a comparison
 * loose enough to stop caring about key order must NOT become loose enough to miss a real difference,
 * because this function is the only thing standing between "we wrote it" and a receipt saying so.
 */
import { describe, expect, test } from "bun:test";
import { verifySavedEntity } from "./verify";

const entity = (over: Record<string, unknown> = {}) =>
  ({ schemaVersion: "1", kind: "preset", id: "t", body: { name: "T", prompts: [] }, ...over }) as never;

const stamp = { "vaud-studio": { raw: null, unmapped: { importedAt: "2026-01-01T00:00:00.000Z" } } };

describe("verifySavedEntity", () => {
  test("the same content in a different key order verifies", () => {
    // The real defect: a proposed entity gains `original` last, a stored one already carries it in
    // the middle. Same piece, different key order, and every create reported failed after writing.
    const proposed = entity();
    const saved = {
      schemaVersion: "1", id: "t", original: stamp, kind: "preset", body: { prompts: [], name: "T" },
    } as never;
    expect(verifySavedEntity(proposed, saved)).toBe(true);
  });

  test("the studio's own stamp is ignored, and nothing else in escrow is", () => {
    expect(verifySavedEntity(entity(), entity({ original: stamp }))).toBe(true);
    expect(verifySavedEntity(
      entity({ original: { ...stamp, sillytavern: { raw: { a: 1 } } } }),
      entity({ original: { ...stamp, sillytavern: { raw: { a: 2 } } } }),
    )).toBe(false);
  });

  test("a field set to undefined equals an absent one, because storage cannot tell them apart", () => {
    expect(verifySavedEntity(entity({ description: undefined }), entity())).toBe(true);
  });

  test("array order still counts, because block order IS the preset", () => {
    const a = entity({ body: { name: "T", prompts: [{ id: "x" }, { id: "y" }] } });
    const b = entity({ body: { name: "T", prompts: [{ id: "y" }, { id: "x" }] } });
    expect(verifySavedEntity(a, b)).toBe(false);
  });

  test("a real difference is still caught, at every depth", () => {
    expect(verifySavedEntity(entity(), entity({ id: "other" }))).toBe(false);
    expect(verifySavedEntity(entity(), entity({ body: { name: "Different", prompts: [] } }))).toBe(false);
    expect(verifySavedEntity(
      entity({ body: { name: "T", prompts: [{ id: "x", content: "a" }] } }),
      entity({ body: { name: "T", prompts: [{ id: "x", content: "b" }] } }),
    )).toBe(false);
  });

  test("a missing field is not equal to a present one", () => {
    expect(verifySavedEntity(entity({ description: "why" }), entity())).toBe(false);
  });

  test("null and absent are NOT the same, since null is an authored value", () => {
    expect(verifySavedEntity(entity({ description: null }), entity())).toBe(false);
  });
});
