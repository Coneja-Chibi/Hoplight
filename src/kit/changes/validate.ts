/**
 * Read-only validation of one accumulated Kit draft against canonical shape and current revision.
 */
import { parseCanonicalEntity } from "../../entities/runtime-schema";
import type { KitBridge } from "../bridge";
import type { ChangeDraft } from "./types";
import { entityRevision } from "./revision";

export interface ChangeValidation {
  draftId: string;
  status: ChangeDraft["status"];
  canonical: boolean;
  current: boolean;
  valid: boolean;
  errors: readonly string[];
}

/** Validate without changing draft state or writing to Studio storage. */
export async function validateChangeDraft(
  draft: ChangeDraft,
  bridge: KitBridge,
): Promise<ChangeValidation> {
  const errors: string[] = [];
  let canonical = true;
  try {
    parseCanonicalEntity(draft.proposed);
  } catch (error) {
    canonical = false;
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const stored = await bridge.read(draft.target.kind, draft.target.id);
  const current = draft.mode === "create"
    ? stored === null
    : stored !== null && entityRevision(stored) === draft.target.revision;
  if (!current) {
    errors.push(draft.mode === "create"
      ? "The requested piece id now exists."
      : "The stored piece no longer matches the draft baseline revision.");
  }
  if (draft.status !== "draft") {
    errors.push(`Draft status is ${draft.status}; only an active draft can be applied.`);
  }
  return {
    draftId: draft.id,
    status: draft.status,
    canonical,
    current,
    valid: canonical && current && draft.status === "draft",
    errors,
  };
}
