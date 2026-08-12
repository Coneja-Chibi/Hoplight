/** Strict runtime decoder for canonical HTML-document bodies. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type { HtmlDocBody } from "./schema";

/**
 * A ceiling, matching what the surface that draws it will accept.
 *
 * SealedHtmlPreview truncates past BACKDROP_HTML_CAP, so a document larger than that is one whose
 * end can never be seen. Refusing it at the boundary is honest; storing it and silently drawing
 * three quarters is not.
 */
export const HTMLDOC_CAP = 200_000;

const bodyShape = defineExhaustiveShape<HtmlDocBody>()({
  name: z.string().max(200),
  html: z.string().max(HTMLDOC_CAP),
  summary: z.string().max(500).optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  notes: z.string().optional(),
});

export const htmlDocBodySchema = z.strictObject(bodyShape);
export const htmlDocProfileSchema = htmlDocBodySchema.partial();
