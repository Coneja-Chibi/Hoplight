/**
 * Shared canonical create-draft boundary for drop-in Studio lifecycle tools.
 */
import { canonicalId, CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { CapabilityChange, ContentKind } from "../../entities/capabilities";
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import { isSafeStudioId } from "../../studio/path-policy";
import { reviewChangeDraft } from "../changes/review";
import type { ChangeOperation } from "../changes/types";
import type { ToolContext, ToolResult } from "./tool";

export const MEDIA_REF_HELP =
  "Image reference: use a data URI for inline bytes, an http(s) URL, or an existing asset/archive reference.";
export const MIME_HELP =
  "Optional MIME content type such as image/png, image/jpeg, image/webp, image/gif, audio/mpeg, or video/mp4.";

interface CreateDraftRequest {
  kind: ContentKind;
  id?: string;
  name: string;
  body: unknown;
  input: unknown;
  changes?: readonly CapabilityChange[];
  /** Escrow carried from a source piece. A copy that drops it silently loses every unmapped
   *  platform-native field, which is the data loss rule 2 exists to prevent. Absent for
   *  from-scratch creation, which has no source to preserve. */
  original?: unknown;
  /** Per-app overrides carried from a source piece, for the same reason as `original`. */
  profiles?: unknown;
  /** Capability id recorded on the operation; defaults to the create workflow for this kind. */
  capabilityId?: string;
}

/** Derive and validate the requested exact Studio id without touching storage. */
export function createEntityId(name: string, requested?: string): string | null {
  const id = requested ?? canonicalId(name);
  return isSafeStudioId(id) ? id : null;
}

/** Build one preview-only create draft, refusing an existing target before composition. */
export async function createEntityDraft(
  request: CreateDraftRequest,
  ctx: ToolContext,
): Promise<ToolResult> {
  if (!ctx.changes) throw new Error("Creation requires a session draft store.");
  const id = createEntityId(request.name, request.id);
  if (!id) {
    return {
      summary: `create ${request.kind}: invalid id`,
      output: "The requested piece id is not safe for Studio storage.",
      outcome: "failed",
    };
  }
  if (await ctx.bridge.read(request.kind, id)) {
    return {
      summary: `create ${request.kind}/${id}: exists`,
      output: `A ${request.kind} with id "${id}" already exists. Choose another id or edit it.`,
      outcome: "stale",
    };
  }
  const entity = parseCanonicalEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: request.kind,
    id,
    body: request.body,
    ...(request.original === undefined ? {} : { original: request.original }),
    ...(request.profiles === undefined ? {} : { profiles: request.profiles }),
  });
  const operation: ChangeOperation = {
    capabilityId: request.capabilityId ?? `studio.${request.kind}.create`,
    input: request.input,
    changes: request.changes ?? [{
      path: "/",
      label: `new ${request.kind}`,
      before: null,
      after: request.name,
    }],
    warnings: [],
    platformImpact: [],
  };
  const draft = ctx.changes.create(entity, operation);
  return {
    summary: `create ${request.kind}/${id}: preview ready`,
    output: JSON.stringify({
      draftId: draft.id,
      target: draft.target,
      changes: operation.changes,
    }),
    outcome: "draft",
    review: reviewChangeDraft(draft),
  };
}
