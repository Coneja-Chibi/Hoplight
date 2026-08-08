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

/**
 * The piece as a READER should see it: everything except its original.
 *
 * A canonical entity carries the raw file it was imported from, so a re-export can be byte-faithful.
 * That is ballast for the writer and it is NOT content. Handing it to a model does three bad things
 * at once, and the middle one was reported from the field:
 *
 * 1. It is often enormous. One real card in a studio here is 2.4MB of raw, which is most of a
 *    context window spent on a second copy of what sits beside it in canonical form.
 * 2. IT CAN BE STALE, silently. A card imported with an embedded lorebook keeps that book in its
 *    raw while the live copy is lifted out to a standalone piece behind knowledgeRefs. Edit the
 *    standalone and the raw still holds the text from import day, so the model was handed current
 *    fields, a pointer to the real book, and a full stale copy of the lore, with nothing saying
 *    which was which. It answered from the copy that actually had entries in it.
 * 3. It is a second description of the same piece, in a wire dialect the model has to guess at.
 *
 * A pointer into the original does not resolve either, which is the honest consequence rather than
 * an oversight: this tool reads canonical pieces, and the raw is not one.
 */
function readable(entity: unknown): unknown {
  if (!entity || typeof entity !== "object") return entity;
  const { original: _raw, ...rest } = entity as Record<string, unknown>;
  return rest;
}

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
    const selected = resolveJsonPointer(readable(entity), path);
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
