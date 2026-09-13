/**
 * Deterministic revision for parsed canonical entities at optimistic-write boundaries.
 */
import { sha256Hex } from "../core/sha256";
import type { ParsedCanonicalEntity } from "./runtime-schema";

/** Hash the complete parsed entity, including escrow, in its stable parsed key order. */
export function entityRevision(entity: ParsedCanonicalEntity): string {
  const value = JSON.stringify(entity);
  if (typeof Bun !== "undefined") return new Bun.CryptoHasher("sha256").update(value).digest("hex");
  return sha256Hex(value);
}
