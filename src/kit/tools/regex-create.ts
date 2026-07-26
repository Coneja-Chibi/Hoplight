/**
 * Standalone regex-set creation workflow that stores rules as sealed data.
 */
import { z } from "zod";
import { emptyRegexSetBody } from "../../entities/regex";
import type { HarnessTool } from "./tool";
import { createEntityDraft } from "./_create-common";

const rule = z.strictObject({
  id: z.string().min(1).describe("stable rule id"),
  label: z.string().describe("creator-facing rule name"),
  note: z.string().optional(),
  find: z.string().describe("bare regex pattern without slash delimiters"),
  flags: z.string().default("g").describe("verbatim regex flags, usually g, gi, gim, or gms"),
  replace: z.string().describe("replacement text; stored as data and never evaluated"),
  phases: z.array(z.string()).min(1)
    .describe("pipeline phases such as input, output, display, prompt, lorebook, or reasoning"),
  enabled: z.boolean().default(true),
  sortOrder: z.number().default(100),
  minDepth: z.number().nullable().optional(),
  maxDepth: z.number().nullable().optional(),
  runOnEdit: z.boolean().optional(),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(20_000).optional(),
  enabled: z.boolean().default(true),
  rules: z.array(rule).max(1_000).optional().describe("initial stored rules; none are executed on create"),
});

const regexCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_regex_create",
  description:
    "Create a standalone regex-set draft with optional initial typed rules. Patterns remain sealed data.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.regex.create",
    domain: "studio",
    kind: "regex",
    area: "lifecycle",
    action: "create",
    summary: "Create a new standalone regex set without executing its rules.",
    aliases: ["new regex", "create regex set", "find replace rules", "regex script"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `regex/${id ?? name}`,
  async execute(args, ctx) {
    const body = {
      ...emptyRegexSetBody(args.name),
      ...(args.description ? { description: args.description } : {}),
      enabled: args.enabled,
      rules: args.rules ?? [],
    };
    return createEntityDraft({
      kind: "regex",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{
        path: "/",
        label: "new regex set",
        before: null,
        after: { name: args.name, rules: body.rules.length },
      }],
    }, ctx);
  },
};

export default regexCreate;
