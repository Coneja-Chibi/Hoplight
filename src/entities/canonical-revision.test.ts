/** Native host hashing and the browser fallback must produce one revision contract. */
import { expect, test } from "bun:test";
import type { ParsedCanonicalEntity } from "./runtime-schema";
import { sha256Hex } from "../core/sha256";
import { entityRevision } from "./canonical-revision";

test("entity revision matches the runtime-neutral SHA-256", () => {
  const entity = {
    schemaVersion: "1",
    kind: "character",
    id: "ada",
    body: { identity: { name: "Ada" } },
  } as ParsedCanonicalEntity;
  expect(entityRevision(entity)).toBe(sha256Hex(JSON.stringify(entity)));
});
