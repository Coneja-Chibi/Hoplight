/**
 * Read-only meta-tool for searching and reading Hoplight's authored documentation corpus.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";

const docId = z.string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, "use a catalog documentation id");
const sectionSlug = z.string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "use a heading slug returned by docs search");

const input = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(200),
    audience: z.enum(["user", "dev"]).optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  z.strictObject({
    action: z.literal("read"),
    id: docId,
    section: sectionSlug.optional(),
    maxChars: z.number().int().min(1_000).max(12_000).optional(),
  }),
]);

const renderAnchors = (
  anchors: readonly { text: string; slug: string }[],
  limit = 8,
): string => anchors.slice(0, limit).map((anchor) => `${anchor.text} [${anchor.slug}]`).join("; ");

/** Create the drop-in tool; the docs repository arrives through ToolContext at dispatch. */
export function createDocsQueryTool(): HarnessTool<z.infer<typeof input>> {
  return {
    name: "docs_query",
    description: "Search Hoplight's own user and developer docs, or read one catalog page or heading section.",
    exposure: "direct",
    effect: "read",
    input,
    concurrencyKey: (args) =>
      args.action === "search"
        ? `docs/search/${args.audience ?? "all"}/${args.query.toLowerCase()}`
        : `docs/read/${args.id}/${args.section ?? "all"}`,
    async execute(args, { docs }) {
      if (!docs) {
        return {
          summary: "docs unavailable",
          output: "Hoplight's documentation corpus is unavailable in this Kit session.",
        };
      }
      if (args.action === "search") {
        const matches = await docs.search(args.query, {
          audience: args.audience,
          limit: args.limit,
        });
        if (matches.length === 0) {
          return {
            summary: `docs search "${args.query}": 0`,
            output: `No Hoplight documentation matches "${args.query}".`,
          };
        }
        const rows = matches.map((doc) => {
          const anchors = renderAnchors(doc.anchors);
          const best = doc.section ? `  best section: ${doc.section}` : "";
          return [
            `${doc.id}  ${doc.title}  (${doc.audience})`,
            `  ${doc.summary}`,
            ...(best ? [best] : []),
            ...(doc.excerpt ? [`  match: ${doc.excerpt}`] : []),
            ...(anchors ? [`  sections: ${anchors}`] : []),
          ].join("\n");
        });
        return {
          summary: `docs search "${args.query}": ${matches.length}`,
          output: rows.join("\n"),
        };
      }
      const page = await docs.read(args.id, args.section, args.maxChars);
      if (!page) {
        const suffix = args.section ? `#${args.section}` : "";
        return {
          summary: `docs read ${args.id}${suffix}: not found`,
          output: `No catalog documentation exists at "${args.id}${suffix}". Search the docs first.`,
        };
      }
      const suffix = page.section ? `#${page.section}` : "";
      const continuation = page.truncated
        ? `\n\n[Output capped. Read a listed section for a narrower answer. Sections: ${renderAnchors(page.anchors)}]`
        : "";
      return {
        summary: `docs read ${page.id}${suffix}`,
        output: `${page.body}${continuation}`,
      };
    },
  };
}

export default createDocsQueryTool();
