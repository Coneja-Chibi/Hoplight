/**
 * Studio lifecycle: copy one piece to a new id. A copy is a create, so it composes a preview-only
 * draft through the shared create boundary and reaches storage via the same create-only compare that
 * refuses an occupied id. There is no second write path.
 *
 * The copy carries `body`, `profiles` AND `original` forward. Dropping escrow would quietly strip
 * every platform-native field the canonical model does not express, which is exactly the silent data
 * loss rule 2 forbids: a duplicate that cannot round-trip like its source is not a duplicate.
 *
 * Renaming the copy is a display-name change, not an id change. `newId` is the storage identity and
 * `name` is what a human reads; supplying neither derives an id from the source id.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import { createEntityDraft } from "./_create-common";

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the source piece lives in"),
  id: z.string().trim().min(1).max(120).describe("exact studio id of the piece to copy"),
  newId: z.string().trim().min(1).max(120).optional()
    .describe("storage id for the copy; derived from the source id when omitted"),
  name: z.string().trim().min(1).max(200).optional()
    .describe("display name for the copy; the source name is kept when omitted"),
});

/** The body's own display name, wherever this kind keeps it. Characters nest it under identity. */
const readName = (kind: string, body: unknown): string => {
  const record = (body ?? {}) as Record<string, unknown>;
  if (kind === "character") {
    const identity = (record.identity ?? {}) as Record<string, unknown>;
    return typeof identity.name === "string" ? identity.name : "";
  }
  return typeof record.name === "string" ? record.name : "";
};

/** Write the new display name back where this kind keeps it, leaving every other field untouched. */
const withName = (kind: string, body: unknown, name: string): unknown => {
  const record = { ...((body ?? {}) as Record<string, unknown>) };
  if (kind === "character") {
    const identity = { ...((record.identity ?? {}) as Record<string, unknown>), name };
    return { ...record, identity };
  }
  return { ...record, name };
};

const duplicate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_duplicate",
  description:
    "Copy an existing studio piece to a new id, preserving its platform-native escrow. Use this "
    + "before a risky edit, or to fork a variant. Previews the copy; nothing is saved until applied.",
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.piece.duplicate",
    domain: "studio",
    area: "lifecycle",
    action: "duplicate",
    summary: "Copy one studio piece to a new id, escrow intact.",
    aliases: ["duplicate", "copy piece", "clone character", "fork", "make a variant"],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ kind, id }) => `studio/${kind}/${id}`,
  async execute(args, ctx) {
    const source = await ctx.bridge.read(args.kind, args.id);
    if (!source) {
      return {
        summary: `duplicate ${args.kind}/${args.id}: not found`,
        output: `No ${args.kind} with id "${args.id}" in the studio. Nothing was copied.`,
        outcome: "stale",
      };
    }
    const entity = source as unknown as {
      body: unknown;
      profiles?: unknown;
      original?: unknown;
    };
    const sourceName = readName(args.kind, entity.body);
    const name = args.name ?? (sourceName ? `${sourceName} (copy)` : args.id);
    return createEntityDraft({
      kind: args.kind,
      id: args.newId ?? `${args.id}-copy`,
      name,
      body: withName(args.kind, entity.body, name),
      input: args,
      capabilityId: "studio.piece.duplicate",
      ...(entity.original === undefined ? {} : { original: entity.original }),
      ...(entity.profiles === undefined ? {} : { profiles: entity.profiles }),
      changes: [{
        path: "/",
        label: `copy of ${args.kind}/${args.id}`,
        before: null,
        after: { name, escrowCarried: entity.original !== undefined },
      }],
    }, ctx);
  },
};

export default duplicate;
