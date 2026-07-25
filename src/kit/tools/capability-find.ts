/**
 * Direct tool factory for bounded semantic capability search and next-round disclosure.
 */
import { z } from "zod";
import { CAPABILITY_DOMAINS } from "../../entities/capabilities";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import type { CapabilityRuntime } from "../capabilities/runtime";
import type { HarnessTool } from "./tool";

const target = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS),
  id: z.string().min(1),
});

const platform = z.string().trim().min(1).max(100).optional();

const input = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("search"),
    target: target.optional(),
    domain: z.enum(CAPABILITY_DOMAINS).optional(),
    query: z.string().trim().min(1).max(200),
    platform,
  }),
  z.strictObject({
    action: z.literal("browse"),
    target: target.optional(),
    domain: z.enum(CAPABILITY_DOMAINS).optional(),
    area: z.string().trim().min(1).max(100).optional(),
    platform,
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  z.strictObject({
    action: z.literal("describe"),
    target: target.optional(),
    domain: z.enum(CAPABILITY_DOMAINS).optional(),
    id: z.string()
      .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}$/),
    platform,
  }),
]);

/** Bind catalog discovery to one session-local progressive exposure scope. */
export function createCapabilityFindTool(
  runtime: CapabilityRuntime,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "capability_find",
    description:
      "Search for typed content operations, browse collapsed areas and actions, or describe and "
      + "reveal one exact operation for the next step.",
    exposure: "direct",
    effect: "read",
    activity: "discovering",
    input,
    concurrencyKey: ({ target, domain }) =>
      `capabilities/${domain ?? "all"}/${target?.kind ?? "all"}/${target?.id ?? "none"}`,
    async execute(args) {
      if (args.action === "search") {
        const hits = runtime.find({
          ...(args.target ? { kind: args.target.kind } : {}),
          ...(args.domain ? { domain: args.domain } : {}),
          query: args.query,
          ...(args.platform ? { platform: args.platform } : {}),
        });
        return {
          summary: `capability search: ${hits.length}`,
          output: JSON.stringify({
            ...(args.target ? { target: args.target } : {}),
            matches: hits.map(({ descriptor, score }) => ({
              id: descriptor.id,
              tool: descriptor.toolName,
              domain: descriptor.domain,
              ...(descriptor.kind ? { kind: descriptor.kind } : {}),
              area: descriptor.area,
              action: descriptor.action,
              summary: descriptor.summary,
              platforms: descriptor.platforms,
              effect: descriptor.effect,
              score,
            })),
          }),
        };
      }
      if (args.action === "browse") {
        const result = runtime.browse({
          ...(args.target ? { kind: args.target.kind } : {}),
          ...(args.domain ? { domain: args.domain } : {}),
          ...(args.area ? { area: args.area } : {}),
          ...(args.platform ? { platform: args.platform } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        });
        return {
          summary: args.area
            ? `capability browse ${args.domain ?? "all"}/${args.area}: ${result.totalCapabilities}`
            : `capability browse ${args.domain ?? "all"}: ${result.areas.length} areas`,
          output: JSON.stringify({
            ...(args.target ? { target: args.target } : {}),
            ...(args.domain ? { domain: args.domain } : {}),
            ...(args.area ? { area: args.area } : {}),
            domains: result.domains,
            areas: result.areas,
            capabilities: result.capabilities,
            totalCapabilities: result.totalCapabilities,
            offset: result.offset,
            limit: result.limit,
          }),
        };
      }
      const descriptor = runtime.describe({
        ...(args.target ? { kind: args.target.kind } : {}),
        ...(args.domain ? { domain: args.domain } : {}),
        id: args.id,
        ...(args.platform ? { platform: args.platform } : {}),
      });
      if (!descriptor) {
        return {
          summary: `capability describe ${args.id}: unavailable`,
          output: JSON.stringify({
            ...(args.target ? { target: args.target } : {}),
            id: args.id,
            error: "Capability is unknown, hidden, for another kind, or unavailable on this platform.",
          }),
        };
      }
      return {
        summary: `capability describe ${descriptor.id}: revealed`,
        output: JSON.stringify({
          ...(args.target ? { target: args.target } : {}),
          capability: {
            id: descriptor.id,
            tool: descriptor.toolName,
            domain: descriptor.domain,
            ...(descriptor.kind ? { kind: descriptor.kind } : {}),
            area: descriptor.area,
            action: descriptor.action,
            summary: descriptor.summary,
            aliases: descriptor.aliases,
            platforms: descriptor.platforms,
            effect: descriptor.effect,
          },
        }),
      };
    },
  };
}
