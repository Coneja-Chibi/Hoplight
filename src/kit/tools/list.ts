/**
 * Read tool: list the studio's pieces, all decks or one. Wraps the bridge's list seam; never writes.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { summaryLine } from "./_shared/format";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";

const LIMIT = 200;

const input = z.object({
  kind: z
    .enum(STUDIO_ENTITY_KINDS)
    .optional()
    .describe("which deck to list (character, lorebook, persona, pack, regex, preset); omit for all"),
});

const list: HarnessTool<z.infer<typeof input>> = {
  name: "list",
  description: "List the pieces in the studio. Give a kind to list one deck, or omit it to list everything.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ kind }) => `studio/list/${kind ?? "all"}`,
  async execute({ kind }, { bridge }) {
    const summaries = await bridge.list(kind);
    const label = kind ?? "all";
    if (summaries.length === 0) {
      return { summary: `list ${label}: 0`, output: kind ? `No ${kind} pieces in the studio.` : "The studio is empty." };
    }
    const shown = summaries.slice(0, LIMIT).map(summaryLine);
    const overflow = summaries.length > LIMIT ? `\n... and ${summaries.length - LIMIT} more (showing first ${LIMIT})` : "";
    return {
      summary: `list ${label}: ${summaries.length}`,
      output: `${summaries.length} ${kind ? `${kind} pieces` : "pieces"}:\n${shown.join("\n")}${overflow}`,
    };
  },
};

export default list;
