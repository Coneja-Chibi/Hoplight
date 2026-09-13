/** Strict runtime decoder for canonical quick-reply bodies. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import type { QuickReply, QuickReplyBody } from "./schema";

const replyShape = defineExhaustiveShape<QuickReply>()({
  id: z.string().min(1),
  // Empty is legal: ST ships icon-only buttons whose label is "".
  label: z.string().max(200),
  message: z.string().max(64_000),
  title: z.string().max(500).optional(),
  hidden: z.boolean().optional(),
  extras: z.record(z.string(), z.unknown()).optional(),
});

const bodyShape = defineExhaustiveShape<QuickReplyBody>()({
  name: z.string().max(200),
  replies: z.array(z.strictObject(replyShape)).max(500),
  extras: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

export const quickReplyBodySchema = z.strictObject(bodyShape);
export const quickReplyProfileSchema = quickReplyBodySchema.partial();
