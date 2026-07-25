/**
 * Read tool: find pieces whose name, id, or kind contains a query. Wraps the bridge list seam.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { summaryLine } from "./_shared/format";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";

const LIMIT = 100;

const input = z.object({
  query: z.string().min(1).describe("text to look for in piece names, ids, and kinds"),
  kind: z.enum(STUDIO_ENTITY_KINDS).optional().describe("narrow the search to one deck; omit for all"),
});

const search: HarnessTool<z.infer<typeof input>> = {
  name: "search",
  description: "Find pieces whose name, id, or kind contains some text. Narrow to one deck with kind.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ query, kind }) => `studio/search/${kind ?? "all"}/${query.toLowerCase()}`,
  async execute({ query, kind }, { bridge }) {
    const needle = query.toLowerCase();
    const hits = (await bridge.list(kind)).filter((summary) =>
      summary.name.toLowerCase().includes(needle)
      || summary.id.toLowerCase().includes(needle)
      || summary.kind.toLowerCase().includes(needle));
    if (hits.length === 0) {
      return { summary: `search "${query}": 0`, output: `Nothing matches "${query}".` };
    }
    const shown = hits.slice(0, LIMIT).map(summaryLine);
    const overflow = hits.length > LIMIT ? `\n... and ${hits.length - LIMIT} more (showing first ${LIMIT})` : "";
    return {
      summary: `search "${query}": ${hits.length}`,
      output: `${hits.length} match "${query}":\n${shown.join("\n")}${overflow}`,
    };
  },
};

export default search;
