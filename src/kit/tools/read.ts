/**
 * Read tool: open one piece and hand its canonical content to the model. Wraps the bridge read seam.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import {
  JSON_POINTER_PATTERN,
  outlineJson,
  resolveJsonPointer,
  stringifyJsonValue,
} from "../results/json-navigation";

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().min(1).describe("the piece's id (its filename without .json)"),
  action: z.enum(["read", "outline"]).optional(),
  path: z.string().regex(JSON_POINTER_PATTERN)
    .describe("an RFC 6901 JSON Pointer returned by outline; empty means the whole entity")
    .optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(12_000).optional(),
});

const MAX_WHOLE_ENTITY_CHARS = 64_000;

const read: HarnessTool<z.infer<typeof input>> = {
  name: "studio_read",
  description:
    "Read one complete canonical piece by default. Use outline, JSON Pointer paths, offsets, or an "
    + "opaque result handle only when a genuinely oversized piece needs narrower traversal.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ kind, id }) => `${kind}/${id}`,
  async execute(args, { bridge, results }) {
    const { kind, id } = args;
    const entity = await bridge.read(kind, id);
    if (!entity) {
      return { summary: `read ${kind}/${id}: not found`, output: `No ${kind} with id "${id}" in the studio.` };
    }
    const path = args.path ?? "";
    const selected = resolveJsonPointer(entity, path);
    if (!selected.found) {
      return {
        summary: `read ${kind}/${id}: path not found`,
        output: JSON.stringify({
          target: { kind, id },
          path,
          error: "JSON Pointer does not exist on this canonical entity.",
        }),
      };
    }

    if ((args.action ?? "read") === "outline") {
      const entries = outlineJson(selected.value, path);
      const offset = Math.max(0, Math.min(entries.length, args.offset ?? 0));
      const limit = Math.max(1, Math.min(200, args.limit ?? 50));
      const page = entries.slice(offset, offset + limit);
      const end = offset + page.length;
      return {
        summary: `outline ${kind}/${id}${path || "/"}`,
        output: JSON.stringify({
          target: { kind, id },
          path,
          entries: page,
          offset,
          limit,
          totalEntries: entries.length,
          nextOffset: end < entries.length ? end : null,
        }),
      };
    }

    const content = stringifyJsonValue(selected.value);
    const requestedPage = args.offset !== undefined || args.limit !== undefined;
    if (!requestedPage && content.length <= MAX_WHOLE_ENTITY_CHARS) {
      return {
        summary: `read ${kind}/${id}`,
        output: JSON.stringify({
          target: { kind, id },
          path,
          spilled: false,
          content,
          offset: 0,
          limit: content.length,
          totalChars: content.length,
          nextOffset: null,
        }),
      };
    }
    if (!requestedPage && results) {
      try {
        const captured = results.capture(`${kind}/${id}${path || "/"}`, content);
        if (captured.spilled) {
          return {
            summary: `read ${kind}/${id}: spilled ${captured.totalChars} chars`,
            output: JSON.stringify({
              target: { kind, id },
              path,
              ...captured,
            }),
          };
        }
      } catch {
        // A value larger than the bounded store remains recoverable through offset and limit paging.
      }
    }

    const offset = Math.max(0, Math.min(content.length, args.offset ?? 0));
    const limit = Math.max(1, Math.min(12_000, args.limit ?? 4_096));
    const page = content.slice(offset, offset + limit);
    const end = offset + page.length;
    return {
      summary: `read ${kind}/${id}`,
      output: JSON.stringify({
        target: { kind, id },
        path,
        spilled: false,
        content: page,
        offset,
        limit,
        totalChars: content.length,
        nextOffset: end < content.length ? end : null,
      }),
    };
  },
};

export default read;
