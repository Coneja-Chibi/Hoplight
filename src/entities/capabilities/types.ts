/**
 * Pure semantic capability contracts shared by Kit, the Workbench, and future engine consumers.
 * Capabilities preview canonical changes; they never perform I/O.
 */
import type { z } from "zod";
import type { canonicalEntitySchema, ParsedCanonicalEntity } from "../runtime-schema";

export type ContentKind = z.infer<typeof canonicalEntitySchema>["kind"];
export type CapabilityEffect = "read" | "draft";
export type CapabilityExposure = "direct" | "deferred" | "hidden";

export interface CapabilityTargetInput {
  id: string;
}

export interface CapabilityChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface CapabilityPlatformImpact {
  platform: string;
  disposition: "carried" | "changed" | "not-representable";
  detail: string;
}

export interface CapabilityPreview<Entity extends ParsedCanonicalEntity = ParsedCanonicalEntity> {
  entity: Entity;
  changes: readonly CapabilityChange[];
  warnings: readonly string[];
  platformImpact: readonly CapabilityPlatformImpact[];
}

export interface ContentCapability<
  Input = unknown,
  Entity extends ParsedCanonicalEntity = ParsedCanonicalEntity,
> {
  id: `${ContentKind}.${string}`;
  kind: ContentKind;
  area: string;
  action: string;
  summary: string;
  aliases: readonly string[];
  platforms: readonly string[] | "canonical";
  exposure: CapabilityExposure;
  effect: CapabilityEffect;
  input: z.ZodType<Input>;
  concurrencyKey(input: Input): string;
  preview(entity: Entity, input: Input): CapabilityPreview<Entity>;
}
