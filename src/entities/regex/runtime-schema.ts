/** Strict runtime decoders for canonical regex-set bodies and card-embedded regex scripts. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type {
  CharacterRegexScript,
  RegexRule,
  RegexRuleCondition,
  RegexSetBody,
} from "./schema";

const stringArray = z.array(z.string());
const unknownRecord = z.record(z.string(), z.unknown());

const conditionShape = defineExhaustiveShape<RegexRuleCondition>()({
  ruleId: z.string(),
  matched: z.boolean(),
});

export const regexRuleConditionSchema = z.strictObject(conditionShape);

const ruleShape = defineExhaustiveShape<RegexRule>()({
  id: z.string(),
  label: z.string(),
  note: z.string().optional(),
  find: z.string(),
  flags: z.string(),
  useFlags: z.boolean().optional(),
  replace: z.string(),
  trimStrings: stringArray.optional(),
  phases: stringArray,
  targets: z.array(z.enum(["prompt", "response", "display"])).optional(),
  substituteFind: z.enum(["none", "raw", "escaped", "after"]).optional(),
  minDepth: z.number().nullable().optional(),
  maxDepth: z.number().nullable().optional(),
  runOnEdit: z.boolean().optional(),
  characterIds: stringArray.optional(),
  firstMatchOnly: z.boolean().optional(),
  condition: regexRuleConditionSchema.optional(),
  overlay: z.boolean().optional(),
  enabled: z.boolean(),
  sortOrder: z.number(),
  extras: unknownRecord.optional(),
});

export const regexRuleSchema = z.strictObject(ruleShape);

const bodyShape = defineExhaustiveShape<RegexSetBody>()({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rules: z.array(regexRuleSchema),
});

export const regexBodySchema = z.strictObject(bodyShape);
export const regexProfileSchema = regexBodySchema.partial();

const embeddedShape = defineExhaustiveShape<CharacterRegexScript>()({
  label: z.string().optional(),
  find: z.string(),
  replace: z.string(),
  phase: z.string(),
  flags: z.string().optional(),
  useFlags: z.boolean().optional(),
});

export const characterRegexScriptSchema = z.strictObject(embeddedShape);
