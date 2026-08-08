/**
 * Read tool: the person's own groupings of pieces - a cast, a series, this week's four things.
 *
 * WHY THE AGENT NEEDS THIS AT ALL. It can already list and search the studio, so it can find any
 * piece; what it cannot do without this is know which pieces somebody considers to BELONG TOGETHER.
 * That is a fact about intent, it exists nowhere in the files themselves, and "the cast" means a
 * specific eleven characters out of a hundred and sixty-nine.
 *
 * READ-ONLY, matching the bridge seam. Making and breaking groupings stays a human action.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { resolveCollection } from "../../studio/collections-shape";

const input = z.object({
  id: z
    .string()
    .optional()
    .describe("one collection's id, as in @collection:the-cast; omit to list every collection"),
});

/** `kind:id  Name` - the same shape summaryLine gives, built from the resolved piece. */
const memberLine = (piece: { kind: string; id: string; name?: string }): string =>
  `  ${piece.kind}:${piece.id}${piece.name ? `  ${piece.name}` : ""}`;

const collections: HarnessTool<z.infer<typeof input>> = {
  name: "studio_collections",
  description:
    "See the collections the person has made - their own groupings of pieces, with what is in each. "
    + "Give an id to see one collection's contents, or omit it to see them all.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ id }) => `studio/collections/${id ?? "all"}`,
  async execute({ id }, { bridge }) {
    const file = await bridge.collections?.();
    const all = file?.collections ?? [];
    if (all.length === 0) {
      return {
        summary: "collections: 0",
        output: "No collections yet. The person groups pieces themselves; nothing here is automatic.",
      };
    }

    const wanted = id ? all.filter((c) => c.id === id) : all;
    if (wanted.length === 0) {
      return {
        summary: `collections: no "${id}"`,
        output: `No collection with id "${id}". There are ${all.length}: ${all.map((c) => c.id).join(", ")}`,
      };
    }

    const live = await bridge.list();
    const blocks = wanted.map((collection) => {
      const { present, missing } = resolveCollection(collection, live);
      const head = `${collection.name} (@collection:${collection.id}) - ${present.length} piece${present.length === 1 ? "" : "s"}`;
      const note = collection.note ? `\n  ${collection.note}` : "";
      const body = present.length ? `\n${present.map(memberLine).join("\n")}` : "\n  (empty)";
      /**
       * MISSING MEMBERS ARE NAMED, not quietly omitted. A collection that silently shrinks reads as
       * the app having lost something, and the agent repeating a shorter list back would confirm
       * that impression. Whoever deleted the piece is the only one who knows if it was on purpose.
       */
      const gone = missing.length
        ? `\n  (${missing.length} member${missing.length === 1 ? "" : "s"} no longer in the studio: ${missing.map((m) => `${m.kind}:${m.id}`).join(", ")})`
        : "";
      return `${head}${note}${body}${gone}`;
    });

    return {
      summary: id ? `collection ${id}` : `collections: ${all.length}`,
      output: blocks.join("\n\n"),
    };
  },
};

export default collections;
