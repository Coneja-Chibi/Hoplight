/**
 * Compile-only proofs that exact runtime shapes reject common schema drift escapes.
 */
import { z } from "zod";
import { defineExhaustiveShape } from "./runtime-shape";

interface CompleteProbe {
  union: "a" | "b";
  object: { kind: "a"; value: string } | { kind: "b"; value: number };
  items: Array<"a" | "b">;
  plain: string;
  optional?: number;
}

defineExhaustiveShape<CompleteProbe>()({
  union: z.enum(["a", "b"]),
  object: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("a"), value: z.string() }),
    z.strictObject({ kind: z.literal("b"), value: z.number() }),
  ]),
  items: z.array(z.enum(["a", "b"])),
  plain: z.string(),
  optional: z.number().optional(),
});

defineExhaustiveShape<{ value: "a" | "b" }>()({
  // @ts-expect-error A decoder may not silently drop a union member.
  value: z.literal("a"),
});

defineExhaustiveShape<{ value: { kind: "a" } | { kind: "b" } }>()({
  // @ts-expect-error Object union members are part of the exact field contract.
  value: z.strictObject({ kind: z.literal("a") }),
});

defineExhaustiveShape<{ value: Array<"a" | "b"> }>()({
  // @ts-expect-error Array element unions must remain exhaustive.
  value: z.array(z.literal("a")),
});

defineExhaustiveShape<{ value: string }>()({
  // @ts-expect-error Coercion accepts inputs outside the domain field type.
  value: z.coerce.string(),
});

defineExhaustiveShape<{ value: string }>()({
  // @ts-expect-error `any` cannot prove a runtime boundary.
  value: z.any(),
});

defineExhaustiveShape<{ items: string[] }>()({
  // @ts-expect-error `any` cannot hide inside an array element decoder.
  items: z.array(z.any()),
});

defineExhaustiveShape<{ nested: { value: string } }>()({
  // @ts-expect-error `any` cannot hide inside a nested object decoder.
  nested: z.strictObject({ value: z.any() }),
});

defineExhaustiveShape<{ bag: Record<string, string> }>()({
  // @ts-expect-error `any` cannot hide inside a record value decoder.
  bag: z.record(z.string(), z.any()),
});

defineExhaustiveShape<{
  value: { kind: "a"; value: string } | { kind: "b"; value: number };
}>()({
  // @ts-expect-error `any` cannot hide in one discriminated-union branch.
  value: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("a"), value: z.string() }),
    z.strictObject({ kind: z.literal("b"), value: z.any() }),
  ]),
});

defineExhaustiveShape<{ value: Array<string | number> }>()({
  // @ts-expect-error `any` cannot hide in one array element union branch.
  value: z.array(z.union([z.string(), z.any()])),
});

defineExhaustiveShape<{ value: { safe: string; optional?: number } }>()({
  // @ts-expect-error `any` cannot hide in an optional nested property.
  value: z.strictObject({ safe: z.string(), optional: z.any().optional() }),
});

defineExhaustiveShape<{ value: { maybe: string | null } }>()({
  // @ts-expect-error `any` cannot hide in a nullable nested property.
  value: z.strictObject({ maybe: z.any().nullable() }),
});

defineExhaustiveShape<{ value: string }>()({
  // @ts-expect-error `never` cannot stand in for a real decoder.
  value: z.never(),
});

// @ts-expect-error Every domain property requires a decoder.
defineExhaustiveShape<{ first: string; second?: number }>()({ first: z.string() });

defineExhaustiveShape<{ value: string }>()({
  value: z.string(),
  // @ts-expect-error Canonical decoder shapes cannot invent fields.
  extra: z.boolean(),
});
