/**
 * Read-only meta-tool for searching, browsing, outlining, and reading Hoplight docs.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import {
  findOutlineSection,
  type DocOutlineSection,
} from "../docs/navigation";

const docId = z.string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, "use a catalog documentation id");
const sectionSlug = z.string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "use a heading slug returned by docs search");
const collectionId = z.string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, "use a catalog collection id")
  .refine((value) => !value.includes(".."), "collection cannot path-escape");

const input = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(200),
    audience: z.enum(["user", "dev"]).optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  z.strictObject({
    action: z.literal("browse"),
    collection: collectionId.optional(),
    audience: z.enum(["user", "dev"]).optional(),
    offset: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(25).optional(),
  }),
  z.strictObject({
    action: z.literal("outline"),
    id: docId,
    section: sectionSlug
      .describe("Expand one section slug returned by the collapsed page outline")
      .optional(),
  }),
  z.strictObject({
    action: z.literal("read"),
    id: docId,
    section: sectionSlug
      .describe("Read one targeted nugget; omit to read the whole document")
      .optional(),
    maxChars: z.number().int().min(1_000).max(12_000)
      .describe("Bound this response; continue with the returned next offset")
      .optional(),
    offset: z.number().int().min(0).max(10_000_000)
      .describe("Continue a prior whole-document or section read from this character offset")
      .optional(),
  }),
]);

const renderAnchors = (
  anchors: readonly { text: string; slug: string }[],
  limit = 8,
): string => anchors.slice(0, limit).map((anchor) => `${anchor.text} [${anchor.slug}]`).join("; ");

const NAV_AID =
  "Summaries are navigation aids only. Prefer reading the whole document for surrounding constraints; "
  + "use a section read for a targeted nugget or when context is limited.";

const childLabel = (count: number): string =>
  `${count} child section${count === 1 ? "" : "s"}`;

const renderCollapsedSections = (sections: readonly DocOutlineSection[]): string[] =>
  sections.map((section) =>
    `  ${section.level === 3 ? "H3" : "H2"} ${section.text} [${section.slug}]  `
    + `(${childLabel(section.children.length)})`);

const renderExpandedSection = (
  section: DocOutlineSection,
  depth = 0,
): string[] => {
  const pad = "  ".repeat(depth + 1);
  const topics = section.topics.length > 0 ? `  topics: ${section.topics.join(", ")}` : "";
  const rows = [
    `${pad}${section.level === 3 ? "H3" : "H2"} ${section.text} [${section.slug}]`,
  ];
  if (section.summary) rows.push(`${pad}  ${section.summary}`);
  if (topics) rows.push(`${pad}${topics}`);
  for (const child of section.children) {
    rows.push(...renderExpandedSection(child, depth + 1));
  }
  return rows;
};

/** Create the drop-in tool; the docs repository arrives through ToolContext at dispatch. */
export function createDocsQueryTool(): HarnessTool<z.infer<typeof input>> {
  return {
    name: "docs_query",
    description:
      "Search, traverse collapsed collections and page outlines, or read Hoplight docs. "
      + "Prefer a whole-document read for context; use section reads for targeted nuggets. "
      + "Continue bounded reads with the returned offset.",
    exposure: "direct",
    effect: "read",
    input,
    concurrencyKey: (args) => {
      switch (args.action) {
        case "search":
          return `docs/search/${args.audience ?? "all"}/${args.query.toLowerCase()}`;
        case "browse":
          return `docs/browse/${args.collection ?? "root"}/${args.audience ?? "all"}/${args.offset ?? 0}/${args.limit ?? 12}`;
        case "outline":
          return `docs/outline/${args.id}/${args.section ?? "root"}`;
        case "read":
          return `docs/read/${args.id}/${args.section ?? "all"}/${args.offset ?? 0}`;
      }
    },
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
          output: `${rows.join("\n")}\n\n${NAV_AID}`,
        };
      }
      if (args.action === "browse") {
        const result = await docs.browse({
          collection: args.collection,
          audience: args.audience,
          offset: args.offset,
          limit: args.limit,
        });
        if (!result) {
          return {
            summary: "docs browse: invalid collection",
            output: `Collection "${args.collection ?? ""}" is not a valid catalog collection id.`,
          };
        }
        const where = result.collection ?? "root";
        const collectionRows = result.collections.map(
          (entry) => `  collection ${entry.id}  (${entry.pageCount} pages)`,
        );
        const pageRows = result.pages.map((page) => {
          const overview = page.semanticSummary || page.summary;
          const topics = page.topics.length > 0 ? `\n    topics: ${page.topics.join(", ")}` : "";
          return `  page ${page.id}  ${page.title}  (${page.audience})\n    ${overview}${topics}`;
        });
        const pageRange = result.totalPages === 0
          ? "pages 0/0"
          : `pages ${result.offset + 1}-${Math.min(result.offset + result.pages.length, result.totalPages)} of ${result.totalPages}`;
        return {
          summary: `docs browse ${where}: ${result.collections.length} collections, ${pageRange}`,
          output: [
            `Collection: ${where}`,
            ...(collectionRows.length > 0 ? ["Collections:", ...collectionRows] : ["Collections: (none)"]),
            `Pages (${pageRange}, limit ${result.limit}):`,
            ...(pageRows.length > 0 ? pageRows : ["  (none)"]),
            "",
            NAV_AID,
          ].join("\n"),
        };
      }
      if (args.action === "outline") {
        const outline = await docs.outline(args.id);
        if (!outline) {
          return {
            summary: `docs outline ${args.id}: not found`,
            output: `No catalog documentation exists at "${args.id}". Browse or search the docs first.`,
          };
        }
        const selected = args.section
          ? findOutlineSection(outline.sections, args.section)
          : null;
        if (args.section && !selected) {
          return {
            summary: `docs outline ${outline.id}#${args.section}: not found`,
            output: `No catalog section exists at "${outline.id}#${args.section}". `
              + "Request the collapsed page outline and choose a returned slug.",
          };
        }
        const overview = outline.semanticSummary || outline.summary;
        const topics = outline.topics.length > 0 ? `topics: ${outline.topics.join(", ")}` : "";
        const sections = selected
          ? renderExpandedSection(selected)
          : renderCollapsedSections(outline.sections);
        const suffix = selected ? `#${selected.slug}` : "";
        return {
          summary: `docs outline ${outline.id}${suffix}`,
          output: [
            `${outline.id}  ${outline.title}  (${outline.audience})`,
            overview,
            ...(topics ? [topics] : []),
            selected ? "Expanded section:" : "Sections (collapsed):",
            ...(sections.length > 0 ? sections : ["  (none)"]),
            "",
            NAV_AID,
          ].join("\n"),
        };
      }
      const page = await docs.read(args.id, {
        section: args.section,
        maxChars: args.maxChars,
        offset: args.offset,
      });
      if (!page) {
        const suffix = args.section ? `#${args.section}` : "";
        return {
          summary: `docs read ${args.id}${suffix}: not found`,
          output: `No catalog documentation exists at "${args.id}${suffix}". Search the docs first.`,
        };
      }
      const suffix = page.section ? `#${page.section}` : "";
      const scope = page.section ? "section nugget" : "whole document";
      const continuation = page.nextOffset !== null
        ? `\n\n[${scope} chars ${page.offset}-${page.nextOffset} of ${page.totalChars}. `
          + `Continue with {"action":"read","id":"${page.id}",`
          + `${page.section ? `"section":"${page.section}",` : ""}`
          + `"offset":${page.nextOffset}}. `
          + `Sections: ${renderAnchors(page.anchors)}]`
        : `\n\n[${scope} read complete: chars ${page.offset}-${page.totalChars} of ${page.totalChars}.`
          + `${page.section ? " Prefer the whole document when surrounding constraints matter." : ""}]`;
      return {
        summary: `docs read ${page.id}${suffix}`,
        output: `${page.body}${continuation}`,
      };
    },
  };
}

export default createDocsQueryTool();
