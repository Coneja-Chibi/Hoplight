/**
 * Make a drawing: an HTML document kept as a studio piece.
 *
 * WHY THIS IS THE ONLY NEW TOOL. Everything else asked for - rename, edit, move, group, delete,
 * duplicate, list, open - already exists and is generic over the entity kind. A drawing that is a
 * PIECE inherits all of it the moment it can be created; a drawing that is text in a reply inherits
 * none of it, because those tools have nothing to point at. So the whole feature is one create.
 *
 * IT DRAFTS, LIKE EVERY OTHER CREATE. The result is a preview the Gate presents, not a file already
 * on disk. Writing is the person's to approve, and this tool is no exception for being convenient.
 *
 * THE HTML IS NEVER EXECUTED, HERE OR ANYWHERE. It is stored verbatim and drawn through
 * SealedHtmlPreview: a srcdoc iframe with `sandbox=""` and a CSP of `script-src 'none';
 * connect-src 'none'; img-src data: blob:`, over DOMPurify-cleaned markup. Storing it changes
 * nothing about that - storage is not trust - and this file deliberately does no sanitising of its
 * own, so there is exactly one place that decides what may render.
 */
import { z } from "zod";
import { emptyHtmlDocBody } from "../../entities/htmldoc/schema";
import { HTMLDOC_CAP } from "../../entities/htmldoc/runtime-schema";
import type { HarnessTool } from "./tool";
import { createEntityDraft } from "./_create-common";

const input = z.strictObject({
  name: z.string().trim().min(1).max(200)
    .describe("what the drawing is called, as it will appear in the Library"),
  html: z.string().min(1).max(HTMLDOC_CAP)
    .describe(
      "the document. All CSS renders, including grid, flexbox, custom properties, gradients, "
      + "transforms and animations; a <style> block works wherever you put it, head or body; "
      + "images must be data: URIs. NOTHING executes and nothing is fetched: <script> and event "
      + "attributes are stripped, so are iframe/object/embed/link/meta/base, and every http(s) "
      + "image, font or request fails. Form controls (form/input/button/textarea/select) are "
      + "stripped too, so DRAW a button as a styled div or span rather than using a real one - a "
      + "<button> loses its shape and leaves its label as bare text. Static wireframes, mockups "
      + "and diagrams.",
    ),
  id: z.string().trim().min(1).max(200).optional()
    .describe("exact studio id; derived from the name when omitted"),
  summary: z.string().trim().max(500).optional()
    .describe("one line on what this draws, so a list of drawings is readable"),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional()
    .describe("labels for grouping; the person can also file it into a collection afterwards"),
});

const htmlDocCreate: HarnessTool<z.infer<typeof input>> = {
  name: "studio_htmldoc_create",
  description:
    "Save an HTML document as a piece in the studio, so it can be opened as a tab, renamed, "
    + "grouped, duplicated and deleted like anything else. Reach for it when the person asks for a "
    + "wireframe, mockup, diagram or styled layout they want to KEEP - a one-off they only want to "
    + "glance at can stay as an ```html block in the reply instead. Nothing in the document ever "
    + "runs: it draws with scripts and network access off, so do not write JavaScript or link "
    + "remote images and fonts.",
  // Deferred like every other create: found through capability search when somebody actually wants
  // to make one, rather than sitting in the belt for every turn that will never draw anything.
  exposure: "deferred",
  effect: "draft",
  discovery: {
    id: "studio.htmldoc.create",
    domain: "studio",
    kind: "htmldoc",
    area: "lifecycle",
    action: "create",
    summary: "Save an HTML document as a piece, drawn with scripts and network access off.",
    // The words somebody actually uses for this. "Wireframe" and "mockup" matter most: nobody asks
    // for an "htmldoc", they ask to be shown what something will look like.
    aliases: ["wireframe", "mockup", "html page", "diagram", "visual", "layout", "draw this"],
    platforms: "canonical",
  },
  input,
  // Two drafts of the same drawing at once would race for one id; keyed like every other create.
  concurrencyKey: ({ id, name }) => `htmldoc/${id ?? name}`,
  async execute(args, ctx) {
    const body = {
      ...emptyHtmlDocBody(),
      name: args.name,
      html: args.html,
      ...(args.summary ? { summary: args.summary } : {}),
      ...(args.tags && args.tags.length > 0 ? { tags: args.tags } : {}),
    };
    return createEntityDraft(
      {
        kind: "htmldoc",
        name: args.name,
        body,
        input: args,
        ...(args.id ? { id: args.id } : {}),
      },
      ctx,
    );
  },
};

export default htmlDocCreate;
