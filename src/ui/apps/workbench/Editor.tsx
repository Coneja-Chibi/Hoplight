/**
 * The character editor pane (CONTRACT V2 port of the deleted vanilla editor.ts; bones transcribed
 * from RC's CharacterEditorBento, skin is the house dark-stage look). Slice 1: the fixed Identity
 * card, the reorderable prose cards, explicit save (button + Ctrl+S) with dirty tracking and a
 * beforeunload guard, and a read-only tail for every canonical field the editor does not write yet.
 *
 * One instance is mounted per open character piece and kept mounted (hidden via CSS) while its tab
 * stays open, so its React state IS the unsaved draft - the same "closing discards" contract as the
 * deleted instance-cache Map, now expressed as ordinary component lifetime.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import {
  applyEdits,
  computeDirty,
  getAtPath,
  IDENTITY_FIELDS,
  KNOWN_FIELD_ORDER,
  moveCard,
  PROSE_CARDS,
  reconcileOrder,
  type CardDef,
} from "./editor-core";
import { fieldsFor } from "./inspect-core";
import styles from "./Editor.module.css";
import roomStyles from "./styles.module.css";

const ALL_DEFS: CardDef[] = [...IDENTITY_FIELDS, ...PROSE_CARDS];
const RENDERED = new Set(PROSE_CARDS.map((c) => c.id));
/** inspector labels the editor now owns; the read-only tail shows the rest */
const COVERED_LABELS = new Set([
  "tagline",
  "description",
  "personality",
  "scenario",
  "first message",
  "example messages",
  "full name",
  "title",
  "age",
  "pronouns",
]);

const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

interface EditorInit {
  entity: Record<string, unknown>;
  baseline: Record<string, unknown>;
  hadOrder: boolean;
  order: string[];
}

function initEditor(rawEntity: unknown): EditorInit {
  const entity = rec(rawEntity);
  const baseline = structuredClone(rec(entity.body));
  const savedOrder = rec(baseline.presentation).fieldOrder;
  const hadOrder = Array.isArray(savedOrder) && savedOrder.length > 0;
  const order = reconcileOrder(savedOrder);
  return { entity, baseline, hadOrder, order };
}

export interface CharacterEditorProps {
  /** the fetched entity (summary fields + canonical body) - fetched once by the caller */
  entity: unknown;
  api: AppContext["api"];
  setStatus(text: string): void;
}

/** Build the writable pane for one canonical character. */
export function CharacterEditor({ entity, api, setStatus }: CharacterEditorProps): JSX.Element {
  const [init] = useState(() => initEditor(entity));
  const [baseline, setBaseline] = useState<Record<string, unknown>>(init.baseline);
  const [order, setOrder] = useState<string[]>(init.order);
  const orderBaselineRef = useRef<string[]>(init.order);
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);

  const dirty = computeDirty(baseline, edits, ALL_DEFS, orderBaselineRef.current, order);
  const valueOf = (def: CardDef): string => edits.get(def.id) ?? getAtPath(baseline, def.path);
  const setEdit = (id: string, value: string): void => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
  };

  const doSave = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    const name = (edits.get("name") ?? getAtPath(baseline, ["identity", "name"])).trim();
    if (!name) {
      setStatus("a name is required before saving");
      return;
    }
    setSaving(true);
    try {
      const newBody = applyEdits(baseline, edits, ALL_DEFS);
      if (init.hadOrder || JSON.stringify(order) !== JSON.stringify(KNOWN_FIELD_ORDER)) {
        newBody.presentation = { ...rec(newBody.presentation), fieldOrder: [...order] };
      }
      await api.saveEntity({ ...init.entity, body: newBody });
      setBaseline(structuredClone(newBody));
      setEdits(new Map());
      orderBaselineRef.current = [...order];
      setStatus(`${name} saved`);
    } catch (e) {
      setStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [api, baseline, dirty, edits, init.entity, init.hadOrder, order, saving, setStatus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); // the shell owns no save; without this the browser offers to save the page
        void doSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault(); // the standard unsaved-changes prompt
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [doSave, dirty]);

  const move = (def: CardDef, dir: -1 | 1): void => {
    setOrder((prev) => moveCard(prev, def.id, dir, RENDERED));
  };

  const cardById = new Map<string, JSX.Element>(
    PROSE_CARDS.map((def) => {
      const value = valueOf(def);
      const full = value !== "";
      return [
        def.id,
        <div className={styles.card} key={def.id}>
          <div className={styles.head}>
            <span className={styles.k}>{def.label}</span>
            <span className={`${styles.dot}${full ? ` ${styles.full}` : ""}`} />
            <div className={styles.mv}>
              <button type="button" className={styles.ar} title={`Move ${def.label} up`} onClick={() => move(def, -1)}>
                ↑
              </button>
              <button type="button" className={styles.ar} title={`Move ${def.label} down`} onClick={() => move(def, 1)}>
                ↓
              </button>
            </div>
          </div>
          <textarea
            className={`${styles.ta}${def.mono ? ` ${styles.mono}` : ""}`}
            spellCheck={false}
            value={value}
            onChange={(e) => setEdit(def.id, e.target.value)}
          />
          <span className={styles.cnt}>{`${value.length} chars`}</span>
        </div>,
      ];
    }),
  );

  const tail = fieldsFor("character", baseline).filter((f) => !COVERED_LABELS.has(f.k));

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <button type="button" className={styles.save} disabled={saving || !dirty} onClick={() => void doSave()}>
          Save
        </button>
        <span className={`${styles.flag}${dirty ? ` ${styles.on}` : ""}`}>
          <span className={styles.flagDot} />
          {dirty ? "unsaved changes" : "saved"}
        </span>
      </div>

      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.k}>identity</span>
        </div>
        <div className={styles.idGrid}>
          {IDENTITY_FIELDS.map((def) => (
            <div className={`${styles.field}${def.id === "name" || def.id === "tagline" ? ` ${styles.span2}` : ""}`} key={def.id}>
              <span className={styles.k}>{def.label}</span>
              <input className={styles.in} value={valueOf(def)} onChange={(e) => setEdit(def.id, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.root}>{order.map((id) => cardById.get(id)).filter((el): el is JSX.Element => el !== undefined)}</div>

      {tail.length > 0 && (
        <div className={styles.root}>
          {tail.map((f) => (
            <div className={roomStyles.field} key={f.k}>
              <div className={roomStyles.fk}>{f.k}</div>
              <div className={roomStyles.fv}>{f.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
