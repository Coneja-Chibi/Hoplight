/** Quick-reply set creation workflow. Messages stay inert text at every lifecycle boundary. */
import { z } from "zod";
import { emptyQuickReplyBody } from "../../entities/quickreply/schema";
import { createEntityDraft } from "./_create-common";
import type { HarnessTool } from "./tool";

const reply = z.strictObject({
  id: z.string().min(1).describe("stable button id"),
  label: z.string().max(200).describe("button label; empty is valid for icon-only buttons"),
  message: z.string().max(64_000).describe("text or slash-command script; stored as data and never executed"),
  title: z.string().max(500).optional(),
  hidden: z.boolean().optional(),
});
const input = z.strictObject({
  name: z.string().trim().min(1).max(200),
  id: z.string().trim().min(1).max(120).optional(),
  replies: z.array(reply).max(500).optional(),
  notes: z.string().max(20_000).optional(),
});

const quickReplyCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_quickreply_create",
  description: "Create a quick-reply set draft with optional buttons. Slash-command messages remain inert text.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.quickreply.create",
    domain: "studio",
    kind: "quickreply",
    area: "lifecycle",
    action: "create",
    summary: "Create a new quick-reply set without executing its messages.",
    aliases: ["new quick replies", "create buttons", "slash command buttons"],
    platforms: ["sillytavern"],
  },
  input,
  concurrencyKey: ({ id, name }) => `quickreply/${id ?? name}`,
  async execute(args, ctx) {
    const body = { ...emptyQuickReplyBody(args.name), replies: args.replies ?? [], ...(args.notes ? { notes: args.notes } : {}) };
    return createEntityDraft({
      kind: "quickreply",
      id: args.id,
      name: args.name,
      body,
      input: args,
      changes: [{ path: "/", label: "new quick-reply set", before: null, after: { name: args.name, replies: body.replies.length } }],
    }, ctx);
  },
};

export default quickReplyCreate;
