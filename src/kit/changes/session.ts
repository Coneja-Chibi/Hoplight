/**
 * One Kit session's draft composer: pure capability previews compose before any store write.
 */
import {
  parseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../../entities/runtime-schema";
import type { ContentCapability, ContentKind } from "../../entities/capabilities";
import { entityRevision } from "./revision";
import type { ChangeDraft } from "./types";

export interface ChangeSession {
  draft(
    capability: ContentCapability,
    input: unknown,
    entity: ParsedCanonicalEntity,
  ): ChangeDraft;
  get(id: string): ChangeDraft | null;
  forTarget(kind: ContentKind, id: string): ChangeDraft | null;
  discard(id: string): ChangeDraft | null;
  startApply(id: string): ChangeDraft | null;
  finishApply(id: string, status: "applied" | "stale" | "failed"): ChangeDraft | null;
}

const targetFrom = (input: unknown): { id: string } | null => {
  if (typeof input !== "object" || input === null) return null;
  const target = (input as { target?: unknown }).target;
  if (typeof target !== "object" || target === null) return null;
  const id = (target as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? { id } : null;
};

const targetKey = (kind: string, id: string): string => `${kind}/${id}`;
const jsonEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Build an isolated in-memory draft store. No state survives the owning Kit session. */
export function createChangeSession(): ChangeSession {
  const drafts = new Map<string, ChangeDraft>();
  const activeByTarget = new Map<string, string>();
  let sequence = 0;

  return {
    draft(capability, input, entity) {
      const target = targetFrom(input);
      if (!target) throw new Error(`${capability.id}: missing target id`);
      if (entity.kind !== capability.kind) {
        throw new Error(`${capability.id}: target kind is ${entity.kind}, expected ${capability.kind}`);
      }
      if (entity.id !== target.id) {
        throw new Error(`${capability.id}: target id is ${target.id}, received ${entity.id}`);
      }

      const key = targetKey(capability.kind, target.id);
      const currentId = activeByTarget.get(key);
      const current = currentId ? drafts.get(currentId) : undefined;
      const revision = entityRevision(entity);
      if (current && current.target.revision !== revision) {
        throw new Error(`${capability.id}: target changed after draft ${current.id} began`);
      }

      const source = current?.proposed ?? entity;
      const preview = capability.preview(source, input);
      const proposed = parseCanonicalEntity(preview.entity);
      if (proposed.kind !== entity.kind || proposed.id !== entity.id) {
        throw new Error(`${capability.id}: preview changed target identity`);
      }
      if (!jsonEqual(proposed.original, entity.original)) {
        throw new Error(`${capability.id}: preview modified original escrow`);
      }

      const draft: ChangeDraft = current
        ? {
            ...current,
            proposed,
            operations: [
              ...current.operations,
              { capabilityId: capability.id, input, changes: preview.changes },
            ],
            warnings: [...current.warnings, ...preview.warnings],
          }
        : {
            id: `draft-${++sequence}`,
            target: { kind: capability.kind, id: target.id, revision },
            baseline: structuredClone(entity),
            proposed,
            operations: [
              { capabilityId: capability.id, input, changes: preview.changes },
            ],
            warnings: [...preview.warnings],
            status: "draft",
          };

      drafts.set(draft.id, draft);
      activeByTarget.set(key, draft.id);
      return draft;
    },

    get(id) {
      return drafts.get(id) ?? null;
    },

    forTarget(kind, id) {
      const draftId = activeByTarget.get(targetKey(kind, id));
      return draftId ? drafts.get(draftId) ?? null : null;
    },

    discard(id) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "draft") return null;
      const discarded: ChangeDraft = { ...draft, status: "discarded" };
      drafts.set(id, discarded);
      activeByTarget.delete(targetKey(draft.target.kind, draft.target.id));
      return discarded;
    },

    startApply(id) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "draft") return null;
      const applying: ChangeDraft = { ...draft, status: "applying" };
      drafts.set(id, applying);
      activeByTarget.delete(targetKey(draft.target.kind, draft.target.id));
      return applying;
    },

    finishApply(id, status) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "applying") return null;
      const finished: ChangeDraft = { ...draft, status };
      drafts.set(id, finished);
      return finished;
    },
  };
}
