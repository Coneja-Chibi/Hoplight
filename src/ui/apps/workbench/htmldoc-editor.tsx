/**
 * HtmlDocEditor - write a drawing on the left, watch it draw on the right.
 *
 * THE PREVIEW IS THE POINT. A wireframe is judged by looking at it, so an editor that only showed
 * markup would make every change a round trip through another surface. It draws live because the
 * source is right there; nothing is saved to see it.
 *
 * SAME SEAL AS EVERYWHERE ELSE. SealedHtmlPreview - srcdoc iframe, `sandbox=""`, CSP of
 * `script-src 'none'; connect-src 'none'; img-src data: blob:`, over DOMPurify-cleaned markup. This
 * content came from a model and stays untrusted no matter which surface shows it, so the editor's
 * pane is the same component as the transcript's inline preview and the full tab. Three sizes, one
 * boundary, nothing to drift.
 *
 * AUTOSAVE THROUGH useEditorGuards, like every other editor here, so a drawing behaves the way a
 * character or a persona does - including the conflict bar when the file changed underneath.
 */
import { useCallback, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import type { HtmlDocBody } from "../../../entities/htmldoc/schema";
import { HTMLDOC_CAP } from "../../../entities/htmldoc/runtime-schema";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { SealedHtmlPreview } from "../../components/sealed-html-preview";
import { useEditorGuards } from "./use-editor-guards";
import styles from "./htmldoc.module.css";

export interface HtmlDocEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Read the stored body, tolerating a piece written by an older shape. */
function bodyFromEntity(entity: unknown): HtmlDocBody {
  const body = isRec(entity) && isRec(entity["body"]) ? entity["body"] : {};
  const tags = Array.isArray(body["tags"]) ? body["tags"].filter((t): t is string => typeof t === "string") : [];
  return {
    name: str(body["name"]),
    html: str(body["html"]),
    ...(str(body["summary"]) ? { summary: str(body["summary"]) } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(str(body["notes"]) ? { notes: str(body["notes"]) } : {}),
  };
}

const same = (a: HtmlDocBody, b: HtmlDocBody): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function HtmlDocEditor({ entity, revision, ctx, piece, topRight }: HtmlDocEditorProps): JSX.Element {
  const revisionRef = useRef(revision);
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const [body, setBody] = useState(() => structuredClone(initBody));
  const [saving, setSaving] = useState(false);

  const dirty = !same(body, baseline);
  const overCap = body.html.length > HTMLDOC_CAP;

  const doSave = useCallback(async (): Promise<boolean> => {
    if (saving || !dirty) return true;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    if (body.html.length > HTMLDOC_CAP) {
      // Refused here rather than truncated: a drawing quietly cut to fit is one whose end nobody
      // knows is missing, and the decoder would reject it anyway.
      ctx.setStatus(`this drawing is longer than ${HTMLDOC_CAP} characters and cannot be saved`);
      return false;
    }
    setSaving(true);
    try {
      const original = isRec(entity) && isRec(entity["original"]) ? entity["original"] : {};
      const saved = await ctx.api.saveEditedEntity(
        { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "htmldoc", id: piece.id, body, original },
        revisionRef.current,
      );
      revisionRef.current = saved.revision;
      setBaseline(structuredClone(body));
      ctx.setStatus(`saved drawing · ${body.name}`);
      return true;
    } catch (e) {
      ctx.setStatus(e instanceof Error ? e.message : "could not save the drawing");
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, body, ctx, entity, piece.id]);

  // Savable only with a name and within the cap, so autosave never retries something that cannot
  // succeed and then reports it as a disk conflict.
  useEditorGuards(ctx, piece, dirty, doSave, body.name.trim().length > 0 && !overCap);

  const patch = (next: Partial<HtmlDocBody>): void => setBody({ ...body, ...next });

  return (
    <div className={styles.room}>
      <div className={styles.head}>
        <input
          className={styles.name}
          value={body.name}
          placeholder="Name this drawing"
          aria-label="Drawing name"
          onChange={(e) => patch({ name: e.target.value })}
        />
        {topRight}
      </div>

      <input
        className={styles.summary}
        value={body.summary ?? ""}
        placeholder="One line on what this draws (optional)"
        aria-label="Summary"
        onChange={(e) => patch({ summary: e.target.value })}
      />

      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            <span className={styles.paneTitle}>Source</span>
            <span className={overCap ? styles.over : styles.count}>
              {`${body.html.length} / ${HTMLDOC_CAP}`}
            </span>
          </div>
          <textarea
            className={styles.source}
            value={body.html}
            spellCheck={false}
            aria-label="HTML source"
            onChange={(e) => patch({ html: e.target.value })}
          />
          {/*
            Said while it is still editable, not on a failed save. The cap is the sealed preview's
            own ceiling, so a longer drawing is one whose end could never be seen anyway.
          */}
          {overCap && (
            <p className={styles.over}>
              {`Too long to save by ${body.html.length - HTMLDOC_CAP} characters. `}
              {"The preview truncates past this point too, so the end would not draw either."}
            </p>
          )}
        </div>

        <div className={styles.pane}>
          <div className={styles.paneHead}>
            <span className={styles.paneTitle}>Drawing</span>
            <span className={styles.count}>scripts and network off</span>
          </div>
          <div className={styles.frame}>
            {body.html.trim()
              ? <SealedHtmlPreview html={body.html} title="This drawing" />
              : <p className={styles.empty}>Write some HTML and it draws here as you type.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
