/**
 * Direct tool factory for bounded semantic capability search and next-round disclosure.
 */
import { z } from "zod";
import { providerToolName } from "../../entities/capabilities";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import type { CapabilityRuntime } from "../capabilities/runtime";
import type { HarnessTool } from "./tool";

const input = z.strictObject({
  target: z.strictObject({
    kind: z.enum(STUDIO_ENTITY_KINDS),
    id: z.string().min(1),
  }),
  query: z.string().trim().min(1),
  platform: z.string().trim().min(1).optional(),
});

/** Bind catalog discovery to one session-local progressive exposure scope. */
export function createCapabilityFindTool(
  runtime: CapabilityRuntime,
): HarnessTool<z.infer<typeof input>> {
  return {
    name: "capability_find",
    description: "Find up to five typed content operations for one piece and reveal them for the next step.",
    exposure: "direct",
    effect: "read",
    activity: "discovering",
    input,
    concurrencyKey: ({ target }) => `capabilities/${target.kind}/${target.id}`,
    async execute({ target, query, platform }) {
      const hits = runtime.find({
        kind: target.kind,
        query,
        ...(platform ? { platform } : {}),
      });
      return {
        summary: `capability find: ${hits.length}`,
        output: JSON.stringify({
          target,
          matches: hits.map(({ capability, score }) => ({
            id: capability.id,
            tool: providerToolName(capability.id),
            area: capability.area,
            action: capability.action,
            summary: capability.summary,
            platforms: capability.platforms,
            score,
          })),
        }),
      };
    },
  };
}
