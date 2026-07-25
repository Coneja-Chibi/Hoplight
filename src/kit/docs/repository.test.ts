/**
 * Integration proof that the real authored corpus is searchable and navigable.
 */
import { expect, test } from "bun:test";
import { createHoplightDocs } from "./repository";

test("full-text search returns the best catalog section for body-only wording", async () => {
  const docs = createHoplightDocs();
  const hits = await docs.search("shared secret world readable process table");
  expect(hits[0]?.id).toBe("reference/security/remote-access");
  expect(hits[0]?.section).toBe("two-listeners-one-trust-boundary");
  expect(hits[0]?.excerpt).toContain("shared secret");
});

test("browse root is metadata-only and lists real collections", async () => {
  const docs = createHoplightDocs();
  const root = await docs.browse();
  expect(root).not.toBeNull();
  expect(root!.collection).toBeNull();
  expect(root!.collections.some((entry) => entry.id === "guide")).toBe(true);
  expect(root!.collections.some((entry) => entry.id === "reference")).toBe(true);
  expect(root!.pages.some((page) => page.id === "01-VISION" || page.id === "README")).toBe(true);
});

test("browse refuses path escape and outline returns a real page map", async () => {
  const docs = createHoplightDocs();
  expect(await docs.browse({ collection: "../SECURITY" })).toBeNull();
  const outline = await docs.outline("reference/security/remote-access");
  expect(outline).not.toBeNull();
  expect(outline!.id).toBe("reference/security/remote-access");
  expect(outline!.sections.some((section) => section.slug.includes("lan")
    || section.slug.includes("listener")
    || section.text.toLowerCase().includes("lan"))).toBe(true);
  expect(await docs.outline("nope/missing")).toBeNull();
});

test("whole-document reads can continue until the complete source is consumed", async () => {
  const docs = createHoplightDocs();
  const first = await docs.read("01-VISION", { maxChars: 1_000 });
  expect(first).not.toBeNull();
  expect(first!.section).toBeNull();
  expect(first!.offset).toBe(0);
  expect(first!.truncated).toBe(true);
  expect(first!.nextOffset).toBeGreaterThan(0);
  expect(first!.totalChars).toBeGreaterThan(first!.body.length);

  const second = await docs.read("01-VISION", {
    maxChars: 1_000,
    offset: first!.nextOffset!,
  });
  expect(second).not.toBeNull();
  expect(second!.offset).toBe(first!.nextOffset!);
  expect(second!.body).not.toBe(first!.body);
});
