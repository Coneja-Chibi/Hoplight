/**
 * PackEditor - open a library pack entity as a "folder": name, brief, full sprite grid.
 * Same SpritePack leaf as Manage Sprites; save writes the pack entity.
 */
import { useCallback, useEffect, useState, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import {
  emptyPack,
  normalizePack,
  resolvePackFace,
  type SpritePackValue,
} from "../../../core/media";
import type { PackBody } from "../../../entities/pack/schema";
import { SpritePack } from "../../components/sprite-pack";
import styles from "./PackEditor.module.css";

export interface PackEditorProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PackBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? e.body : {};
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "Untitled pack";
  const brief = typeof b.brief === "string" ? b.brief : "";
  const pack = normalizePack(b.pack);
  return {
    name,
    ...(brief ? { brief } : {}),
    pack,
  };
}

export function PackEditor({ entity, ctx, piece, topRight }: PackEditorProps): JSX.Element {
  const init = bodyFromEntity(entity);
  const [name, setName] = useState(init.name);
  const [brief, setBrief] = useState(init.brief ?? "");
  const [pack, setPack] = useState<SpritePackValue>(() => init.pack);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ name: init.name, brief: init.brief ?? "", pack: init.pack }),
  );
  const [saving, setSaving] = useState(false);

  const currentKey = JSON.stringify({ name, brief, pack: normalizePack(pack) });
  const dirty = currentKey !== baseline;

  const doSave = useCallback(async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      const body: PackBody = {
        name: name.trim() || "Untitled pack",
        pack: normalizePack(pack),
      };
      if (brief.trim()) body.brief = brief.trim();
      await ctx.api.saveEntity(
        {
          schemaVersion: CANONICAL_SCHEMA_VERSION,
          kind: "pack",
          id: piece.id,
          body,
        },
        { overwrite: true },
      );
      setBaseline(JSON.stringify({ name: body.name, brief: body.brief ?? "", pack: body.pack }));
      ctx.setStatus(`saved pack · ${body.name}`);
    } catch (e) {
      ctx.setStatus(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, name, brief, pack, ctx, piece.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [doSave, dirty]);

  useEffect(() => {
    ctx.setStatus(
      dirty
        ? `pack · ${name || piece.name} · unsaved`
        : `pack · ${name || piece.name} · ${pack.items.length} faces`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, pack.items.length, piece.name]);

  const cover = resolvePackFace(pack, pack.defaultLabel)?.ref ?? pack.items[0]?.ref ?? null;

  return (
    <div className={styles.root} data-kind="pack">
      <div className={styles.bar}>
        <span className={styles.kindTag}>pack folder</span>
        <input
          className={styles.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Pack name"
          placeholder="Pack name"
        />
        <span className={styles.flag}>{dirty ? "unsaved" : "saved"}</span>
        {topRight}
        <button
          type="button"
          className={styles.save}
          disabled={!dirty || saving}
          onClick={() => void doSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className={styles.room}>
        <aside className={styles.aside}>
          <div
            className={styles.cover}
            style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
            aria-hidden
          >
            {!cover ? <b>{(name || "P").charAt(0).toUpperCase()}</b> : null}
          </div>
          <label className={styles.field}>
            Brief
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Optional shelf blurb"
            />
          </label>
          <p className={styles.hint}>
            Library pack folder. Attach onto a character: Manage Sprites → Copy pack from card →
            Pack · …
          </p>
          <p className={styles.meta}>
            {pack.items.length} face{pack.items.length === 1 ? "" : "s"}
            {pack.defaultLabel ? ` · default ${pack.defaultLabel}` : ""}
          </p>
        </aside>
        <main className={styles.main}>
          <SpritePack
            value={pack.items.length ? pack : emptyPack()}
            onChange={(next) => setPack(normalizePack(next))}
            showEnabled={false}
            showDefault
            showSlots
          />
        </main>
      </div>
    </div>
  );
}
