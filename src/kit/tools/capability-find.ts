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

const input = z.strictObject({
  action: z.enum(["search", "find", "browse", "describe"]).optional()
    .describe("omit to infer search from query, describe from id, or browse otherwise"),
  target: target.optional(),
  kind: z.enum(STUDIO_ENTITY_KINDS).optional()
    .describe("content kind filter; target.kind takes precedence when a piece already exists"),
  domain: z.enum(CAPABILITY_DOMAINS).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  id: z.string().trim().min(1).max(200).optional()
    .describe("exact dotted capability id for describe"),
  platform,
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

type CapabilityFindInput = z.infer<typeof input>;
type CapabilityAction = "search" | "browse" | "describe";

const inferAction = (args: CapabilityFindInput): CapabilityAction => {
  if (args.action === "find") return "search";
  if (args.action) return args.action;
  if (args.query) return "search";
  if (args.id) return "describe";
  return "browse";
};

const contentKindFrom = (args: CapabilityFindInput): {
  kind?: (typeof STUDIO_ENTITY_KINDS)[number];
  area?: string;
} => {
  const selected = args.target?.kind ?? args.kind;
  if (selected) return { kind: selected, ...(args.area ? { area: args.area } : {}) };
  if (
    args.domain === "content"
    && args.area
    && STUDIO_ENTITY_KINDS.some((kind) => kind === args.area)
  ) {
    return { kind: args.area as (typeof STUDIO_ENTITY_KINDS)[number] };
  }
  return args.area ? { area: args.area } : {};
};

/** Bind catalog discovery to one session-local progressive exposure scope. */
export function createCapabilityFindTool(
  runtime: CapabilityRuntime,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "capability_find",
    description:
      "Find the right typed operation. Pass query plus optional kind for search, domain/area/kind "
      + "for browse, or id for describe; action is optional. Describe reveals one exact tool.",
    exposure: "direct",
    effect: "read",
    activity: "discovering",
    input,
    concurrencyKey: ({ target, kind, domain }) =>
      `capabilities/${domain ?? "all"}/${target?.kind ?? kind ?? "all"}/${target?.id ?? "none"}`,
    async execute(args) {
      if (args.target && args.kind && args.target.kind !== args.kind) {
        return {
          summary: "capability_find: conflicting kind",
          output: JSON.stringify({
            error: "target.kind and kind must match when both are supplied.",
          }),
        };
      }
      const action = inferAction(args);
      const selection = contentKindFrom(args);
      if (action === "search") {
        if (!args.query) {
          return {
            summary: "capability search: query required",
            output: JSON.stringify({ error: "Search requires a non-empty query." }),
          };
        }
        const hits = runtime.find({
          ...(selection.kind ? { kind: selection.kind } : {}),
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
      if (action === "browse") {
        const result = runtime.browse({
          ...(selection.kind ? { kind: selection.kind } : {}),
          ...(args.domain ? { domain: args.domain } : {}),
          ...(selection.area ? { area: selection.area } : {}),
          ...(args.platform ? { platform: args.platform } : {}),
          ...(args.offset !== undefined ? { offset: args.offset } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        });
        return {
          summary: selection.area
            ? `capability browse ${args.domain ?? "all"}/${selection.area}: ${result.totalCapabilities}`
            : `capability browse ${args.domain ?? "all"}: ${result.areas.length} areas`,
          output: JSON.stringify({
            ...(args.target ? { target: args.target } : {}),
            ...(args.domain ? { domain: args.domain } : {}),
            ...(selection.kind ? { kind: selection.kind } : {}),
            ...(selection.area ? { area: selection.area } : {}),
            domains: result.domains,
            areas: result.areas,
            capabilities: result.capabilities,
            totalCapabilities: result.totalCapabilities,
            offset: result.offset,
            limit: result.limit,
          }),
        };
      }
      if (!args.id) {
        return {
          summary: "capability describe: id required",
          output: JSON.stringify({ error: "Describe requires an exact capability id." }),
        };
      }
      const capabilityId = args.id.replaceAll("/", ".");
      const descriptor = runtime.describe({
        ...(selection.kind ? { kind: selection.kind } : {}),
        ...(args.domain ? { domain: args.domain } : {}),
        id: capabilityId,
        ...(args.platform ? { platform: args.platform } : {}),
      });
      if (!descriptor) {
        return {
          summary: `capability describe ${capabilityId}: unavailable`,
          output: JSON.stringify({
            ...(args.target ? { target: args.target } : {}),
            id: capabilityId,
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
