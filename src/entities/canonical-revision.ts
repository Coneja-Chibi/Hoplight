/**
 * Deterministic revision for parsed canonical entities at optimistic-write boundaries.
 */
import { createHash } from "node:crypto";
import type { ParsedCanonicalEntity } from "./runtime-schema";

/** Hash the complete parsed entity, including escrow, in its stable parsed key order. */
export function entityRevision(entity: ParsedCanonicalEntity): string {
  return createHash("sha256").update(JSON.stringify(entity)).digest("hex");
}
