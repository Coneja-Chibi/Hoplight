/** Semantic lifecycle operations for stored regex-rule data; no rule is executed here. */
import { z } from "zod";
import type { ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import type { CanonicalRegexSet } from "../schema";
import { addRegexRule, moveRegexRule, patchRegexRule, removeRegexRule } from "../operations";
import { preview, targetSchema } from "./shared";

const nullableNumber = z.number().nullable().optional();
const rule = z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  note: z.string().optional(),
  find: z.string(),
  flags: z.string(),
  useFlags: z.boolean().optional(),
  replace: z.string(),
  trimStrings: z.array(z.string()).optional(),
  phases: z.array(z.string()),
  targets: z.array(z.enum(["prompt", "response", "display"])).optional(),
  substituteFind: z.enum(["none", "raw", "escaped", "after"]).optional(),
  minDepth: z.number().nullable().optional(),
  maxDepth: z.number().nullable().optional(),
  runOnEdit: z.boolean().optional(),
  characterIds: z.array(z.string()).optional(),
  firstMatchOnly: z.boolean().optional(),
  condition: z.strictObject({ ruleId: z.string(), matched: z.boolean() }).optional(),
  overlay: z.boolean().optional(),
  enabled: z.boolean(),
  sortOrder: z.number(),
  extras: z.record(z.string(), z.unknown()).optional(),
});
const patch = nonEmptyPatch({
  label: z.string().optional(),
  note: z.string().nullable().optional(),
  find: z.string().optional(),
  flags: z.string().optional(),
  useFlags: z.boolean().nullable().optional(),
  replace: z.string().optional(),
  trimStrings: z.array(z.string()).nullable().optional(),
  phases: z.array(z.string()).optional(),
  targets: z.array(z.enum(["prompt", "response", "display"])).nullable().optional(),
  substituteFind: z.enum(["none", "raw", "escaped", "after"]).nullable().optional(),
  minDepth: nullableNumber,
  maxDepth: nullableNumber,
  runOnEdit: z.boolean().nullable().optional(),
  characterIds: z.array(z.string()).nullable().optional(),
  firstMatchOnly: z.boolean().nullable().optional(),
  condition: z.strictObject({ ruleId: z.string(), matched: z.boolean() }).nullable().optional(),
  overlay: z.boolean().nullable().optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().optional(),
});
const operation = z.union([
  z.strictObject({ type: z.literal("add"), rule, at: z.number().int().nonnegative().optional() }),
  z.strictObject({ type: z.literal("update"), id: z.string().min(1), patch }),
  z.strictObject({ type: z.literal("remove"), id: z.string().min(1) }),
  z.strictObject({ type: z.literal("move"), id: z.string().min(1), to: z.number().int().nonnegative() }),
]);
const input = z.strictObject({ target: targetSchema, operation });

const capability: ContentCapability<z.infer<typeof input>, CanonicalRegexSet> = {
  id: "regex.rules.manage",
  kind: "regex",
  area: "rules",
  action: "manage",
  summary: "Add, edit, remove, or reorder stored standalone regex rules without executing them.",
  aliases: ["regex pattern", "replace rule", "regex phases", "reorder regex"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `regex/${target.id}`,
  preview: (entity, { operation }) => {
    const body = operation.type === "add"
      ? addRegexRule(entity.body, operation.rule, operation.at)
      : operation.type === "remove"
        ? removeRegexRule(entity.body, operation.id)
        : operation.type === "move"
          ? moveRegexRule(entity.body, operation.id, operation.to)
          : patchRegexRule(entity.body, operation.id, Object.fromEntries(
              Object.entries(operation.patch).map(([key, value]) => [key, value === null ? undefined : value]),
            ));
    return preview(entity, body, [{
      path: "body.rules",
      label: `${operation.type} regex rule`,
      before: entity.body.rules,
      after: body.rules,
    }]);
  },
};

export default capability;
