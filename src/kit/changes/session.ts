/**
 * One Kit session's draft composer: pure capability previews compose before any store write.
 */
import {
  parseCanonicalEntity,
  type ParsedCanonicalEntity,
} from "../../entities/runtime-schema";
import type { ContentCapability, ContentKind } from "../../entities/capabilities";
import { entityRevision } from "./revision";
import type { ChangeDraft, ChangeOperation } from "./types";

export interface ChangeSession {
  create(
    entity: ParsedCanonicalEntity,
    operation: ChangeOperation,
  ): ChangeDraft;
  draft(
    capability: ContentCapability,
    input: unknown,
    entity: ParsedCanonicalEntity,
  ): ChangeDraft;
  /**
   * An update draft from a whole proposed entity, with no capability behind it.
   *
   * For an edit a person made directly rather than one a model composed: the preset rail rearranging
   * blocks has no capability id and no preview function, it simply has a before and an after. It
   * still becomes an ordinary draft so it still meets the ordinary Gate, revision check and receipt.
   * Without this the only paths to a write were "a model composed it" or "nothing checked it".
   */
  revise(
    entity: ParsedCanonicalEntity,
    proposed: unknown,
    operation: ChangeOperation,
  ): ChangeDraft;
  get(id: string): ChangeDraft | null;
  list(): readonly ChangeDraft[];
  forTarget(kind: ContentKind, id: string): ChangeDraft | null;
  discard(id: string): ChangeDraft | null;
  fail(id: string): ChangeDraft | null;
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
const cloneDraft = (draft: ChangeDraft): ChangeDraft => structuredClone(draft);

/** Build an isolated in-memory draft store. No state survives the owning Kit session. */
export function createChangeSession(): ChangeSession {
  const drafts = new Map<string, ChangeDraft>();
  const activeByTarget = new Map<string, string>();
  let sequence = 0;

  return {
    create(entity, operation) {
      const proposed = parseCanonicalEntity(entity);
      const kind = proposed.kind as ContentKind;
      const key = targetKey(kind, proposed.id);
      if (activeByTarget.has(key)) {
        throw new Error(`studio.create: an active draft already exists for ${key}`);
      }
      const draft: ChangeDraft = {
        id: `draft-${++sequence}`,
        mode: "create",
        target: {
          kind,
          id: proposed.id,
          revision: "missing",
        },
        baseline: structuredClone(proposed),
        proposed,
        operations: [operation],
        warnings: [...operation.warnings],
        platformImpact: [...operation.platformImpact],
        status: "draft",
      };
      drafts.set(draft.id, draft);
      activeByTarget.set(key, draft.id);
      return cloneDraft(draft);
    },

    revise(entity, proposed, operation) {
      const parsed = parseCanonicalEntity(proposed);
      if (parsed.kind !== entity.kind || parsed.id !== entity.id) {
        throw new Error("revise: the proposal is a different piece");
      }
      // The same guard the capability path enforces. Escrow is the sealed source record, and an edit
      // that rewrote it would quietly discard the platform-native fields it exists to preserve.
      if (!jsonEqual(parsed.original, entity.original)) {
        throw new Error("revise: the proposal modified original escrow");
      }
      const kind = entity.kind as ContentKind;
      const key = targetKey(kind, entity.id);
      const existing = activeByTarget.get(key);
      if (existing) throw new Error(`revise: an active draft already exists for ${key}`);
      const draft: ChangeDraft = {
        id: `draft-${++sequence}`,
        mode: "update",
        target: { kind, id: entity.id, revision: entityRevision(entity) },
        baseline: structuredClone(entity),
        proposed: parsed,
        operations: [operation],
        warnings: [...operation.warnings],
        platformImpact: [...operation.platformImpact],
        status: "draft",
      };
      drafts.set(draft.id, draft);
      activeByTarget.set(key, draft.id);
      return cloneDraft(draft);
    },

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
              {
                capabilityId: capability.id,
                input,
                changes: preview.changes,
                warnings: preview.warnings,
                platformImpact: preview.platformImpact,
              },
            ],
            warnings: [...current.warnings, ...preview.warnings],
            platformImpact: [...current.platformImpact, ...preview.platformImpact],
          }
        : {
            id: `draft-${++sequence}`,
            mode: "update",
            target: { kind: capability.kind, id: target.id, revision },
            baseline: structuredClone(entity),
            proposed,
            operations: [
              {
                capabilityId: capability.id,
                input,
                changes: preview.changes,
                warnings: preview.warnings,
                platformImpact: preview.platformImpact,
              },
            ],
            warnings: [...preview.warnings],
            platformImpact: [...preview.platformImpact],
            status: "draft",
          };

      drafts.set(draft.id, draft);
      activeByTarget.set(key, draft.id);
      return cloneDraft(draft);
    },

    get(id) {
      const draft = drafts.get(id);
      return draft ? cloneDraft(draft) : null;
    },

    list() {
      return [...drafts.values()].map(cloneDraft);
    },

    forTarget(kind, id) {
      const draftId = activeByTarget.get(targetKey(kind, id));
      const draft = draftId ? drafts.get(draftId) : undefined;
      return draft ? cloneDraft(draft) : null;
    },

    discard(id) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "draft") return null;
      const discarded: ChangeDraft = { ...draft, status: "discarded" };
      drafts.set(id, discarded);
      activeByTarget.delete(targetKey(draft.target.kind, draft.target.id));
      return cloneDraft(discarded);
    },

    fail(id) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "draft") return null;
      const failed: ChangeDraft = { ...draft, status: "failed" };
      drafts.set(id, failed);
      activeByTarget.delete(targetKey(draft.target.kind, draft.target.id));
      return cloneDraft(failed);
    },

    startApply(id) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "draft") return null;
      const applying: ChangeDraft = { ...draft, status: "applying" };
      drafts.set(id, applying);
      activeByTarget.delete(targetKey(draft.target.kind, draft.target.id));
      return cloneDraft(applying);
    },

    finishApply(id, status) {
      const draft = drafts.get(id);
      if (!draft || draft.status !== "applying") return null;
      const finished: ChangeDraft = { ...draft, status };
      drafts.set(id, finished);
      return cloneDraft(finished);
    },
  };
}
