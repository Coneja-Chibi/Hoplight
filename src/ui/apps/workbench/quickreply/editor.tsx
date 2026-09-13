/** Writable Workbench editor for canonical quick-reply sets. Message scripts remain inert text. */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { accentVars } from "../../../_shared/decks";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { CanonicalQuickReplySet, QuickReplyBody } from "../../../../entities/quickreply/schema";
import { EditorEhead } from "../../../components/editor-ehead";
import { ExpandTextarea } from "../../../components/expand";
import { EditorConflict } from "../editor-conflict";
import { useEditorGuards } from "../use-editor-guards";
import { useReseedOnReread } from "../use-reseed";
import { apiStatusIs } from "../../../_shared/api-fetch";
import { addReply, patchReply, quickReplyDirty, removeReply } from "./session";
import s from "./quickreply.module.css";

export interface QuickReplyEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function bodyFromEntity(entity: unknown): QuickReplyBody {
  const body = isRec(entity) && isRec(entity.body) ? entity.body : null;
  if (body && typeof body.name === "string" && Array.isArray(body.replies)) {
    return structuredClone(body) as unknown as QuickReplyBody;
  }
  return { name: "Untitled quick replies", replies: [] };
}

export function QuickReplyEditor({ entity, revision, ctx, piece, topRight }: QuickReplyEditorProps): JSX.Element {
  const revisionRef = useRef(revision);
  const initial = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initial));
  const [body, setBody] = useState(() => structuredClone(initial));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = quickReplyDirty(body, baseline);

  useReseedOnReread(revision, dirty, () => {
    const fresh = bodyFromEntity(entity);
    revisionRef.current = revision;
    setBaseline(structuredClone(fresh));
    setBody(structuredClone(fresh));
  });

  const doSave = useCallback(async (): Promise<boolean> => {
    if (saving || !dirty) return true;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    const submitted = structuredClone(body);
    setSaving(true);
    try {
      const original = isRec(entity) && isRec(entity.original)
        ? entity.original as CanonicalQuickReplySet["original"]
        : {};
      const saved = await ctx.api.saveEditedEntity({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "quickreply",
        id: piece.id,
        body: submitted,
        original,
      }, revisionRef.current);
      revisionRef.current = saved.revision;
      setBaseline(structuredClone(submitted));
      setConflict(false);
      ctx.setStatus(`saved quick replies · ${submitted.name}`);
      return true;
    } catch (error) {
      if (apiStatusIs(error, 409)) setConflict(true);
      ctx.setStatus(error instanceof Error ? error.message : "could not save the quick replies");
      return false;
    } finally {
      setSaving(false);
    }
  }, [body, ctx, dirty, entity, piece.id, saving]);

  const autosave = useEditorGuards(ctx, piece, dirty, doSave, body.name.trim().length > 0);
  const takeTheirs = useCallback(() => {
    setBody(structuredClone(baseline));
    setConflict(false);
    autosave.retry();
  }, [autosave, baseline]);
  const keepMine = useCallback(async () => {
    setSaving(true);
    try {
      const original = isRec(entity) && isRec(entity.original) ? entity.original : {};
      await ctx.api.saveEntity({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "quickreply",
        id: piece.id,
        body,
        original,
      }, { overwrite: true });
      const fresh = await ctx.api.getEditableEntity(`kind=quickreply&id=${encodeURIComponent(piece.id)}`);
      revisionRef.current = fresh.revision;
      setBaseline(structuredClone(body));
      setConflict(false);
      autosave.retry();
      ctx.setStatus(`overwrote quick replies · ${body.name}`);
    } catch (error) {
      ctx.setStatus(error instanceof Error ? error.message : "could not overwrite the quick replies");
    } finally {
      setSaving(false);
    }
  }, [autosave, body, ctx, entity, piece.id]);

  return (
    <div className={s.root} style={accentVars(piece.accent) as CSSProperties | undefined}>
      <EditorEhead
        mark={(body.name.trim()[0] || "Q").toUpperCase()}
        name={body.name}
        onNameChange={(name) => setBody((current) => ({ ...current, name }))}
        namePlaceholder="Untitled quick replies"
        nameAriaLabel="Quick-reply set name"
        meta={`quick replies · ${body.replies.length} button${body.replies.length === 1 ? "" : "s"}`}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      />
      {conflict && <EditorConflict what="quick-reply set" onTakeTheirs={takeTheirs} onKeepMine={() => void keepMine()} />}
      <div className={s.body}>
        <div className={s.list}>
          {body.replies.length === 0 && <p className={s.empty}>This set has no buttons yet.</p>}
          {body.replies.map((reply) => (
            <section className={s.row} key={reply.id}>
              <div className={s.stack}>
                <label>
                  <span className={s.label}>Label</span>
                  <input className={s.field} value={reply.label} onChange={(event) =>
                    setBody((current) => patchReply(current, reply.id, { label: event.target.value }))} />
                </label>
                <label>
                  <span className={s.label}>Hover title</span>
                  <input className={s.field} value={reply.title ?? ""} onChange={(event) =>
                    setBody((current) => patchReply(current, reply.id, { title: event.target.value || undefined }))} />
                </label>
              </div>
              <label>
                <span className={s.label}>Message or slash-command text</span>
                <ExpandTextarea
                  label="Quick-reply message"
                  className={`${s.field} ${s.message}`}
                  value={reply.message}
                  onChange={(event) => setBody((current) =>
                    patchReply(current, reply.id, { message: event.target.value }))}
                />
              </label>
              <div className={s.actions}>
                <label><input type="checkbox" checked={reply.hidden === true} onChange={(event) =>
                  setBody((current) => patchReply(current, reply.id, { hidden: event.target.checked }))} /> Hidden</label>
                <button className={s.button} type="button" onClick={() =>
                  setBody((current) => removeReply(current, reply.id))}>Remove</button>
              </div>
            </section>
          ))}
          <button className={`${s.button} ${s.add}`} type="button" onClick={() => setBody(addReply)}>
            Add button
          </button>
        </div>
      </div>
    </div>
  );
}
