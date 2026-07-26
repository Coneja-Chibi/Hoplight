/**
 * Media-pack creation workflow with fully described asset references.
 */
import { z } from "zod";
import { emptyPackBody } from "../../entities/pack/schema";
import type { HarnessTool } from "./tool";
import {
  createEntityDraft,
  MEDIA_REF_HELP,
  MIME_HELP,
} from "./_create-common";

const item = z.strictObject({
  id: z.string().min(1).describe("stable item id unique inside this pack"),
  label: z.string().min(1)
    .describe("expression or sprite label such as neutral, happy, angry, or surprised"),
  ref: z.string().min(1).describe(MEDIA_REF_HELP),
  mime: z.string().optional().describe(MIME_HELP),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  brief: z.string().max(2_000).optional(),
  enabled: z.boolean().default(true),
  defaultLabel: z.string().optional()
    .describe("resting expression label; it must match one item label"),
  items: z.array(item).max(1_000).default([])
    .describe("initial expression or sprite images; each needs an id, label, and resolvable ref"),
});

const packCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_pack_create",
  description:
    "Create a reusable expression or sprite media-pack draft. The schema documents asset refs, "
    + "MIME types, labels, and default-face selection.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.pack.create",
    domain: "studio",
    kind: "pack",
    area: "lifecycle",
    action: "create",
    summary: "Create a reusable expression or sprite media pack.",
    aliases: ["new media pack", "create sprite pack", "expression pack", "face pack"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ id, name }) => `pack/${id ?? name}`,
  async execute(args, ctx) {
    const body = {
      ...emptyPackBody(args.name),
      ...(args.brief ? { brief: args.brief } : {}),
      pack: {
        enabled: args.enabled,
        items: args.items,
        ...(args.defaultLabel ? { defaultLabel: args.defaultLabel } : {}),
      },
    };
    return createEntityDraft({
      kind: "pack",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{
        path: "/",
        label: "new media pack",
        before: null,
        after: {
          name: args.name,
          items: args.items.length,
          defaultLabel: args.defaultLabel ?? null,
        },
      }],
    }, ctx);
  },
};

export default packCreate;
