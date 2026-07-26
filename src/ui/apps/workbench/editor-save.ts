/** Character-editor save and reconciliation orchestration. */
import {
  KNOWN_FIELD_ORDER,
  readPath,
  reconcileAfterSave,
  saveOutcomeStatus,
  writePath,
} from "./editor-core";
import { str } from "./editor-derive";

export interface EditorSaveDeps {
  saving: boolean;
  dirty: boolean;
  baseDraft: Record<string, unknown>;
  originalDraft: Record<string, unknown>;
  order: string[];
  initEnt: Record<string, unknown>;
  hadOrder: boolean;
  setSaving(v: boolean): void;
  setBaseline(v: Record<string, unknown>): void;
  setNativeBaseline(v: Record<string, unknown>): void;
  setBaseDraft(fn: (live: Record<string, unknown>) => Record<string, unknown>): void;
  setOriginalDraft(fn: (live: Record<string, unknown>) => Record<string, unknown>): void;
  orderBaselineRef: { current: string[] };
  expectedRevision: string;
  saveEntity(entity: unknown, expectedRevision: string): Promise<{ revision: string }>;
  setRevision(revision: string): void;
  setStatus(msg: string): void;
}

export async function runEditorSave(d: EditorSaveDeps): Promise<void> {
  if (d.saving || !d.dirty) return;
  const name = str(readPath(d.baseDraft, "identity.name")).trim();
  if (!name) {
    d.setStatus("a name is required before saving");
    return;
  }
  // Immutable save snapshot: only these values go to storage; completion must not read live state.
  let submittedBaseDraft = structuredClone(d.baseDraft);
  if (d.hadOrder || JSON.stringify(d.order) !== JSON.stringify(KNOWN_FIELD_ORDER)) {
    submittedBaseDraft = writePath(submittedBaseDraft, "presentation.fieldOrder", [...d.order]);
  }
  const submittedOriginalDraft = structuredClone(d.originalDraft);
  const submittedOrder = [...d.order];
  const submittedName = name;
  const submittedEntity = {
    ...d.initEnt,
    body: submittedBaseDraft,
    original: submittedOriginalDraft,
  };
  d.setSaving(true);
  try {
    const saved = await d.saveEntity(submittedEntity, d.expectedRevision);
    d.setRevision(saved.revision);
    // Accepted baselines describe exactly what was persisted (this request's snapshot).
    d.setBaseline(structuredClone(submittedBaseDraft));
    d.setNativeBaseline(structuredClone(submittedOriginalDraft));
    d.orderBaselineRef.current = [...submittedOrder];
    // Functional setters: live may have advanced while the request was in flight.
    let bodyDirty = false;
    let originalDirty = false;
    d.setBaseDraft((live) => {
      const r = reconcileAfterSave({ live, submitted: submittedBaseDraft });
      bodyDirty = r.dirty;
      return r.current;
    });
    d.setOriginalDraft((live) => {
      const r = reconcileAfterSave({ live, submitted: submittedOriginalDraft });
      originalDirty = r.dirty;
      return r.current;
    });
    // order has no concurrent setter today; still compare live vs accepted baseline independently.
    const orderDirtyAfter = JSON.stringify(d.order) !== JSON.stringify(submittedOrder);
    const stillDirty = bodyDirty || originalDirty || orderDirtyAfter;
    d.setStatus(saveOutcomeStatus(submittedName, stillDirty));
  } catch (e) {
    // Failure advances no baseline; live edits stay intact.
    d.setStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    d.setSaving(false);
  }
}
