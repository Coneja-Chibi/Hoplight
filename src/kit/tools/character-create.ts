/**
 * Character creation workflow: build one typed canonical card as a preview-only session draft.
 */
import { z } from "zod";
import { canonicalId, CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { isSafeStudioId } from "../../studio/path-policy";
import { reviewChangeDraft } from "../changes/review";
import type { ChangeOperation } from "../changes/types";
import type { HarnessTool } from "./tool";
import { MEDIA_REF_HELP, MIME_HELP } from "./_create-common";

const optionalText = z.string().trim().max(20_000).optional();
const mediaAsset = z.strictObject({
  role: z.enum(["emotion", "outfit", "pose", "background", "other"])
    .describe("how this additional asset is used"),
  ref: z.string().min(1).describe(MEDIA_REF_HELP),
  name: z.string().optional().describe("optional authored asset name"),
  label: z.string().optional()
    .describe("expression, outfit, pose, or background label shown in the studio"),
  primary: z.boolean().optional().describe("main asset for this role"),
  mime: z.string().optional().describe(MIME_HELP),
});
const portrait = z.strictObject({
  ref: z.string().min(1).describe(MEDIA_REF_HELP),
  name: z.string().optional().describe("optional authored portrait name"),
  mime: z.string().optional().describe(MIME_HELP),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional()
    .describe("safe storage id; omit to derive it from name"),
  nickname: z.string().trim().max(200).optional(),
  tagline: z.string().trim().max(500).optional(),
  description: optionalText,
  personality: optionalText,
  scenario: optionalText,
  firstMessage: optionalText,
  exampleMessages: optionalText,
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  portrait: portrait.optional().describe("optional main character portrait"),
  assets: z.array(mediaAsset).max(1_000).optional()
    .describe("additional expression, outfit, pose, background, or other media"),
});

type CharacterCreateInput = z.infer<typeof input>;

const changesFor = (args: CharacterCreateInput): ChangeOperation["changes"] => [
  { path: "/", label: "new character", before: null, after: args.name },
  ...([
    ["tagline", args.tagline],
    ["description", args.description],
    ["personality", args.personality],
    ["scenario", args.scenario],
    ["first message", args.firstMessage],
    ["example messages", args.exampleMessages],
    ["tags", args.tags],
    ["portrait", args.portrait],
    ["media assets", args.assets],
  ] as const)
    .filter((entry) => entry[1] !== undefined)
    .map(([label, after]) => ({
      path: `/${label.replaceAll(" ", "-")}`,
      label,
      before: null,
      after,
    })),
];

const characterCreate: HarnessTool<CharacterCreateInput> = {
  name: "studio_character_create",
  description:
    "Create a new character card as a structured preview. Supply the authored fields you already "
    + "know; the user reviews the complete draft before Kit creates anything.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.character.create",
    domain: "studio",
    kind: "character",
    area: "lifecycle",
    action: "create",
    summary: "Create a new canonical character card through preview and review.",
    aliases: ["new character", "create character", "make character", "new card", "character card"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `character/${id ?? canonicalId(name)}`,
  async execute(args, { bridge, changes }) {
    if (!changes) throw new Error("Character creation requires a session draft store.");
    const id = args.id ?? canonicalId(args.name);
    if (!isSafeStudioId(id)) {
      return {
        summary: "create character: invalid id",
        output: "The requested character id is not safe for Studio storage.",
        outcome: "failed",
      };
    }
    if (await bridge.read("character", id)) {
      return {
        summary: `create character/${id}: exists`,
        output: `A character with id "${id}" already exists. Choose another id or edit it instead.`,
        outcome: "stale",
      };
    }
    const entity = parseCanonicalEntity({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id,
      body: {
        identity: {
          name: args.name,
          ...(args.nickname ? { nickname: args.nickname } : {}),
          ...(args.tagline ? { tagline: args.tagline } : {}),
          ...(args.description ? { description: args.description } : {}),
        },
        persona: {
          ...(args.personality ? { personality: args.personality } : {}),
          ...(args.scenario ? { scenario: args.scenario } : {}),
        },
        prompts: {},
        greetings: {
          ...(args.firstMessage ? { firstMessage: args.firstMessage } : {}),
        },
        examples: {
          ...(args.exampleMessages ? { exampleMessages: args.exampleMessages } : {}),
        },
        media: {
          ...(args.portrait ? {
            portrait: {
              role: "portrait" as const,
              ref: args.portrait.ref,
              primary: true,
              ...(args.portrait.name ? { name: args.portrait.name } : {}),
              ...(args.portrait.mime ? { mime: args.portrait.mime } : {}),
            },
          } : {}),
          ...(args.assets ? { assets: args.assets } : {}),
        },
        attribution: {},
        discovery: {
          ...(args.tags ? { tags: args.tags } : {}),
        },
      },
    });
    const operation: ChangeOperation = {
      capabilityId: "studio.character.create",
      input: args,
      changes: changesFor(args),
      warnings: [],
      platformImpact: [],
    };
    const draft = changes.create(entity, operation);
    return {
      summary: `create character/${id}: preview ready`,
      output: JSON.stringify({
        draftId: draft.id,
        target: draft.target,
        changes: operation.changes,
      }),
      outcome: "draft",
      review: reviewChangeDraft(draft),
    };
  },
};

export default characterCreate;
