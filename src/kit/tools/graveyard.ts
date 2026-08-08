/**
 * Read tool: the block graveyard - blocks taken out of a preset and kept.
 *
 * WHY THE AGENT NEEDS TO SEE IT. Asked to "put back that directive we cut", a model with no view of
 * the graveyard can only offer to write a new one from memory - which is a different block wearing
 * the same name. The buried block is the actual text somebody wrote, and it is sitting right there.
 *
 * READ-ONLY, and burying is a separate tool with its own class in the trust map. A tool that both
 * lists and writes would have to be gated as a write, so every harmless look would ask permission -
 * and a prompt that fires on nothing teaches people to click through the one that matters.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { gravesNewestFirst } from "../../studio/graveyard-shape";

const input = z.object({
  id: z
    .string()
    .optional()
    .describe("one grave's id, to read the whole buried block; omit to list what is buried"),
});

/** Enough of a block to recognise it without printing a wall of prose per row. */
const PREVIEW = 90;

const graveyard: HarnessTool<z.infer<typeof input>> = {
  name: "studio_graveyard",
  description:
    "See the block graveyard: prompt blocks taken out of a preset and kept rather than deleted. "
    + "Give an id to read one buried block in full, or omit it to list what is there. Use this "
    + "before writing a block from scratch that the person may simply have set aside.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ id }) => `studio/graveyard/${id ?? "all"}`,
  async execute({ id }, ctx) {
    const file = await ctx.graveyard?.read();
    const graves = file ? gravesNewestFirst(file) : [];
    if (graves.length === 0) {
      return {
        summary: "graveyard: 0",
        output: "The block graveyard is empty. Nothing has been set aside.",
      };
    }

    if (id !== undefined) {
      const found = graves.find((g) => g.id === id);
      if (!found) {
        return {
          summary: `graveyard: no "${id}"`,
          output: `No grave with id "${id}". There are ${String(graves.length)}: `
            + graves.slice(0, 12).map((g) => g.id).join(", "),
        };
      }
      const from = found.from.presetName || found.from.presetId || "an unrecorded preset";
      return {
        summary: `graveyard ${found.id}`,
        // The whole block, because reading one is the only reason to ask for it by id.
        output: `${found.block.name} (${found.block.role}) - buried from ${from}`
          + `${found.note ? `\nnote: ${found.note}` : ""}\n\n${found.block.content}`,
      };
    }

    const rows = graves.map((g) => {
      const from = g.from.presetName || g.from.presetId || "unknown";
      const head = g.block.content.replace(/\s+/g, " ").trim().slice(0, PREVIEW);
      return `  ${g.id}  ${g.block.name} (${g.block.role}, from ${from})\n    ${head}`;
    });
    return {
      summary: `graveyard: ${String(graves.length)}`,
      output: `${String(graves.length)} buried block${graves.length === 1 ? "" : "s"}, newest first:\n`
        + rows.join("\n"),
    };
  },
};

export default graveyard;
