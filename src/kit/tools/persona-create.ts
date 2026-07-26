/**
 * Persona creation workflow preserving the brief versus injected-content boundary.
 */
import { z } from "zod";
import { emptyPersonaBody } from "../../entities/persona";
import type { HarnessTool } from "./tool";
import {
  createEntityDraft,
  MEDIA_REF_HELP,
  MIME_HELP,
} from "./_create-common";

const portrait = z.strictObject({
  ref: z.string().min(1).describe(MEDIA_REF_HELP),
  mime: z.string().optional().describe(MIME_HELP),
  name: z.string().optional().describe("optional authored asset name"),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  brief: z.string().max(2_000).optional()
    .describe("short shelf summary; this is never injected into the model prompt"),
  content: z.string().max(40_000)
    .describe("full first-person text injected as the user's identity"),
  appearance: z.string().max(20_000).optional(),
  body: z.string().max(20_000).optional(),
  personality: z.string().max(20_000).optional(),
  quirks: z.string().max(20_000).optional(),
  history: z.string().max(20_000).optional(),
  traits: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  tagline: z.string().max(500).optional(),
  pronouns: z.string().max(200).optional(),
  rating: z.enum(["all-ages", "mature", "explicit"]).optional(),
  portrait: portrait.optional().describe("optional main persona portrait"),
});

const personaCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_persona_create",
  description:
    "Create a user persona draft with an explicit shelf brief, injected first-person content, "
    + "structured profile sections, and optional portrait.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.persona.create",
    domain: "studio",
    kind: "persona",
    area: "lifecycle",
    action: "create",
    summary: "Create a new user persona without confusing shelf brief and injected content.",
    aliases: ["new persona", "create persona", "user identity", "user card"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `persona/${id ?? name}`,
  async execute(args, ctx) {
    const sections = {
      ...(args.appearance ? { appearance: args.appearance } : {}),
      ...(args.body ? { body: args.body } : {}),
      ...(args.personality ? { personality: args.personality } : {}),
      ...(args.quirks ? { quirks: args.quirks } : {}),
      ...(args.history ? { history: args.history } : {}),
    };
    const body = {
      ...emptyPersonaBody(args.name),
      content: args.content,
      ...(args.brief ? { brief: args.brief } : {}),
      ...(Object.keys(sections).length > 0 ? { sections } : {}),
      ...(args.traits ? { traits: args.traits } : {}),
      ...(args.tagline || args.pronouns ? {
        identity: {
          ...(args.tagline ? { tagline: args.tagline } : {}),
          ...(args.pronouns ? { pronouns: args.pronouns } : {}),
        },
      } : {}),
      ...(args.rating ? { rating: args.rating } : {}),
      ...(args.portrait ? {
        media: {
          portrait: {
            role: "portrait" as const,
            ref: args.portrait.ref,
            primary: true,
            ...(args.portrait.mime ? { mime: args.portrait.mime } : {}),
            ...(args.portrait.name ? { name: args.portrait.name } : {}),
          },
        },
      } : {}),
    };
    return createEntityDraft({
      kind: "persona",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{
        path: "/",
        label: "new persona",
        before: null,
        after: { name: args.name, portrait: Boolean(args.portrait) },
      }],
    }, ctx);
  },
};

export default personaCreate;
