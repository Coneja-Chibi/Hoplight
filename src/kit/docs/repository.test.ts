/**
 * Integration proof that the real authored corpus is searchable below metadata level.
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
