/**
 * Editing a drawing that already exists.
 *
 * THE GAP THIS FILLS, in the words of the agent that hit it: "the available HTML operation only
 * exposes Create, not Edit, and refused to overwrite the existing focused ID. So the ugly document
 * has not changed and no draft is waiting." That refusal was correct - create-only apply refuses an
 * occupied id rather than overwriting, which is the guarantee that keeps a create from eating a
 * piece - but it left the model with a rewrite it had built, validated, and no way to deliver.
 *
 * Every other kind has had an update capability since the lifecycle was built; this one shipped with
 * a create tool and nothing else, because a drawing arrived as "make me a picture" and nobody asked
 * to change one until they had one worth changing.
 *
 * A PATCH, NOT A REPLACEMENT ENTITY. Passing `html` alone rewrites the markup and leaves the name,
 * summary and tags as they were, which is what "fix the layout" means. Every field is optional and
 * at least one must be present, so an empty call is a refusal rather than a no-op draft somebody has
 * to review.
 *
 * IT PREVIEWS, it does not write. The draft goes to the same Gate as every other change: the person
 * sees the before and after and decides. That is also why the seal reading below is a WARNING rather
 * than a rejection - what will not draw is worth saying, and it is not this capability's call to
 * refuse somebody's markup.
 */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import { nonEmptyPatch } from "../../_shared/capability-schemas";
import { readSeal, sealNotes } from "../../../core/render/seal-policy";
import { HTMLDOC_CAP } from "../runtime-schema";
import type { CanonicalHtmlDoc, HtmlDocBody } from "../schema";

const patchSchema = nonEmptyPatch({
  name: z.string().trim().min(1).max(200).optional()
    .describe("what the drawing is called in the Library"),
  html: z.string().min(1).max(HTMLDOC_CAP).optional()
    .describe("the whole document, replacing what is there; the same rules as creating one"),
  summary: z.string().trim().max(500).optional()
    .describe("one line on what this draws"),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional()
    .describe("labels for grouping; replaces the existing list"),
  notes: z.string().max(4_000).optional()
    .describe("the body's own notes field, not the envelope's note list"),
});

const input = z.strictObject({
  target: z.strictObject({ id: z.string().min(1).describe("the drawing's piece id") }),
  patch: patchSchema,
});

type Input = z.infer<typeof input>;

const FIELDS = ["name", "html", "summary", "tags", "notes"] as const;

const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** Markup is long; a reviewer needs to see THAT it changed and roughly how much, not all of it. */
const shown = (value: unknown): unknown =>
  typeof value === "string" && value.length > 400
    ? `${value.slice(0, 400)}... (${value.length} characters)`
    : value;

const capability: ContentCapability<Input, CanonicalHtmlDoc> = {
  id: "htmldoc.document.update",
  kind: "htmldoc",
  area: "document",
  action: "update",
  summary: "Rewrite a drawing that already exists: its markup, its name, its summary or its tags.",
  aliases: [
    "edit the wireframe",
    "change the mockup",
    "fix the layout",
    "update the drawing",
    "rewrite the html",
    "redo the diagram",
  ],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  // One draft per drawing: two rewrites of the same piece at once would race for its revision.
  concurrencyKey: ({ target }) => `htmldoc/${target.id}`,
  preview: (entity, { patch }) => {
    const before = entity.body;
    const after: HtmlDocBody = { ...before };
    const changes: CapabilityChange[] = [];

    for (const field of FIELDS) {
      const value = patch[field];
      if (value === undefined) continue;
      const prior = before[field];
      if (same(prior, value)) continue;
      // An emptied optional field is removed rather than stored as "", so a drawing with no summary
      // reads the same whether it never had one or lost one.
      if (field !== "name" && field !== "html" && value === "") delete after[field];
      else Object.assign(after, { [field]: value });
      changes.push({
        path: `body.${field}`,
        label: field,
        before: shown(prior),
        after: shown(field !== "name" && field !== "html" && value === "" ? undefined : value),
      });
    }

    // Said on the way through, never enforced here: a person reviewing the draft is the one who
    // decides, and the seal is the thing that actually strips.
    const warnings = patch.html === undefined ? [] : sealNotes(readSeal(patch.html));

    return {
      entity: changes.length > 0 ? { ...entity, body: after } : entity,
      changes,
      warnings,
      platformImpact: [],
    };
  },
};

export default capability;
