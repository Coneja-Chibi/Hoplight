/**
 * Lorebook capability helpers for typed inputs, entity narrowing, and exact preview rows.
 */
import { z } from "zod";
import type { CapabilityChange } from "../../capabilities";
import type { CanonicalLorebook, LorebookBody } from "../schema";

export const targetSchema = z.strictObject({
  id: z.string().min(1).describe("the lorebook piece id"),
});

export const canonicalPlatforms = "canonical" as const;

export function lorebookBody(entity: CanonicalLorebook): LorebookBody {
  return entity.body;
}

export function withLorebookBody(
  entity: CanonicalLorebook,
  body: LorebookBody,
): CanonicalLorebook {
  return body === entity.body ? entity : { ...entity, body };
}

export function change(
  path: string,
  label: string,
  before: unknown,
  after: unknown,
): CapabilityChange | null {
  return Object.is(before, after) ? null : { path, label, before, after };
}
