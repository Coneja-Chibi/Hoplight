/**
 * Read-only traversal of oversized session-local tool observations by opaque handle.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";

const handle = z.string().regex(/^result-\d+$/);

const input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("stat"), handle }),
  z.strictObject({
    action: z.literal("read"),
    handle,
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(12_000).optional(),
  }),
  z.strictObject({
    action: z.literal("search"),
    handle,
    query: z.string().trim().min(1).max(200),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
]);

const resultQuery: HarnessTool<z.infer<typeof input>> = {
  name: "result_query",
  description:
    "Inspect, page through, or search one oversized tool result using its opaque session handle.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ handle: resultHandle }) => `results/${resultHandle}`,
  async execute(args, { results }) {
    if (!results) {
      return {
        summary: `result ${args.handle}: unavailable`,
        output: "This Kit session has no result store.",
      };
    }
    const result = args.action === "stat"
      ? results.stat(args.handle)
      : args.action === "read"
        ? results.read(args.handle, {
            ...(args.offset !== undefined ? { offset: args.offset } : {}),
            ...(args.limit !== undefined ? { limit: args.limit } : {}),
          })
        : results.search(args.handle, {
            query: args.query,
            ...(args.offset !== undefined ? { offset: args.offset } : {}),
            ...(args.limit !== undefined ? { limit: args.limit } : {}),
          });
    if (!result) {
      return {
        summary: `result ${args.handle}: unavailable`,
        output: `No active result named "${args.handle}". It may have expired or been evicted.`,
      };
    }
    return {
      summary: `result ${args.action} ${args.handle}`,
      output: JSON.stringify(result),
    };
  },
};

export default resultQuery;
