/**
 * AltFields normalize + collision-resistant id generation.
 */
import { test, expect } from "bun:test";
import { newAltFieldId, normalizeAltFields } from "./index";

test("normalize keeps only description personality scenario arrays", () => {
  const n = normalizeAltFields({
    description: [{ label: "A", content: "x" }],
    junk: [{ label: "no" }],
    personality: "bad",
  });
  expect(n.description).toEqual([{ id: undefined, label: "A", content: "x" }]);
  expect(n.personality).toBeUndefined();
  expect((n as Record<string, unknown>).junk).toBeUndefined();
});

test("normalize preserves existing ids (does not rewrite on load)", () => {
  const n = normalizeAltFields({
    description: [{ id: "keep-me", label: "A", content: "x" }],
  });
  expect(n.description?.[0]?.id).toBe("keep-me");
});

test("newAltFieldId produces distinct ids on rapid generation", () => {
  const ids = new Set(Array.from({ length: 200 }, () => newAltFieldId()));
  expect(ids.size).toBe(200);
  for (const id of ids) expect(id.startsWith("alt_")).toBe(true);
});
