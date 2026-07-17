/**
 * SpritePack - visual emotion / expression pack editor (label -> image).
 * Platform-agnostic value+onChange. Bridges live outside this leaf.
 */
import { useEffect, useRef, useState, type DragEvent, type JSX } from "react";
import {
  labelFromFilename,
  newPackItemId,
  normalizeLabel,
  normalizePack,
  packFromZipBytes,
  reorderPackItems,
  type ExpressionProfile,
  type SpritePackItem,
  type SpritePackValue,
} from "../../../core/media";
import { ToggleSwitch } from "../toggle-switch";
import styles from "./styles.module.css";

export type { SpritePackItem, SpritePackValue };

export interface SpritePackProps {
  value: SpritePackValue;
  onChange(next: SpritePackValue): void;
  showEnabled?: boolean;
  showDefault?: boolean;
  allowMultiFile?: boolean;
  /** Soft checklist ghosts from host profile */
  profile?: ExpressionProfile;
  showSlots?: boolean;
  /** Scroll/highlight this label when the dialog opens from the strip */
  focusLabel?: string | null;
}

const readFileAsDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("sprite-pack: expected data URL"));
    };
    reader.onerror = () => reject(new Error("sprite-pack: read failed"));
    reader.readAsDataURL(file);
  });

const mimeOf = (file: File): string | undefined =>
  file.type.startsWith("image/") ? file.type : undefined;

/** Compact soft checklist (not full ST 28 unless filled). */
const CORE_VISIBLE = ["neutral", "happy", "sad", "angry", "surprised", "joy", "sadness", "anger", "surprise"];

export function SpritePack({
  value,
  onChange,
  showEnabled = false,
  showDefault = true,
  allowMultiFile = true,
  profile,
  showSlots = false,
  focusLabel = null,
}: SpritePackProps): JSX.Element {
  const pack = normalizePack(value);
  const fileRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);
  const slotLabelRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const focusDone = useRef(false);

  const commit = (next: SpritePackValue): void => onChange(normalizePack(next));

  const setItems = (items: SpritePackItem[]): void => {
    commit({ ...pack, items });
  };

  // New focus target (e.g. strip double-click) always re-scrolls.
  useEffect(() => {
    focusDone.current = false;
  }, [focusLabel]);

  useEffect(() => {
    if (!focusLabel || focusDone.current) return;
    const id = `sp-slot-${normalizeLabel(focusLabel)}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      focusDone.current = true;
    }
  }, [focusLabel, pack.items.length]);

  /** Drop face `fromId` onto face `toId` (stable order via core). */
  const reorder = (fromId: string, toId: string): void => {
    if (fromId === toId) return;
    const ids = pack.items.map((i) => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    commit(reorderPackItems(pack, next));
  };

  const addFiles = async (files: FileList | File[] | null): Promise<void> => {
    if (!files || files.length === 0) return;
    const all = [...files];
    const zips = all.filter(
      (f) =>
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed",
    );
    for (const z of zips) {
      try {
        const buf = new Uint8Array(await z.arrayBuffer());
        commit(packFromZipBytes(buf, pack));
      } catch {
        /* fail closed */
      }
    }

    const list = all.filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    const replaceId = replaceIdRef.current;
    replaceIdRef.current = null;
    const slotLabel = slotLabelRef.current;
    slotLabelRef.current = null;

    if (replaceId) {
      const file = list[0]!;
      try {
        const ref = await readFileAsDataUri(file);
        const mime = mimeOf(file);
        setItems(
          pack.items.map((it) =>
            it.id === replaceId
              ? { ...it, ref, ...(mime ? { mime } : {}) }
              : it,
          ),
        );
      } catch {
        /* fail closed */
      }
      return;
    }

    if (slotLabel && list[0]) {
      const file = list[0];
      try {
        const ref = await readFileAsDataUri(file);
        const mime = mimeOf(file);
        const existing = pack.items.find(
          (it) => normalizeLabel(it.label) === normalizeLabel(slotLabel),
        );
        if (existing) {
          setItems(
            pack.items.map((it) =>
              it.id === existing.id ? { ...it, ref, ...(mime ? { mime } : {}) } : it,
            ),
          );
        } else {
          const item: SpritePackItem = {
            id: newPackItemId(),
            label: slotLabel,
            ref,
            ...(mime ? { mime } : {}),
          };
          commit({
            ...pack,
            items: [...pack.items, item],
            defaultLabel: pack.defaultLabel ?? slotLabel,
          });
        }
      } catch {
        /* fail closed */
      }
      return;
    }

    const added: SpritePackItem[] = [];
    for (const file of list) {
      try {
        const ref = await readFileAsDataUri(file);
        const label = labelFromFilename(file.name);
        const mime = mimeOf(file);
        const item: SpritePackItem = { id: newPackItemId(), label, ref };
        if (mime) item.mime = mime;
        added.push(item);
      } catch {
        /* skip bad file */
      }
    }
    if (added.length === 0) return;
    const batch = allowMultiFile ? added : added.slice(0, 1);
    commit({
      ...pack,
      items: [...pack.items, ...batch],
      defaultLabel: pack.defaultLabel ?? batch[0]?.label,
    });
  };

  const onDropAdd = (e: DragEvent): void => {
    e.preventDefault();
    void addFiles(e.dataTransfer.files);
  };

  // Soft ghosts: first profile slots (capped) that are not yet filled
  const filledNorm = new Set(pack.items.map((i) => normalizeLabel(i.label)));
  const coreSlots =
    showSlots && profile
      ? profile.slots
          .filter((s) => {
            const n = normalizeLabel(s);
            return CORE_VISIBLE.includes(n) && !filledNorm.has(n);
          })
          .slice(0, 8)
      : [];


  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        {showEnabled ? (
          <ToggleSwitch
            on={pack.enabled !== false}
            onChange={(on) => commit({ ...pack, enabled: on })}
            label={pack.enabled === false ? "Pack off" : "Pack on"}
          />
        ) : null}
        {showDefault && pack.items.length > 0 ? (
          <>
            <span className={styles.lbl}>Default</span>
            <select
              className={styles.sel}
              value={pack.defaultLabel ?? ""}
              onChange={(e) =>
                commit({
                  ...pack,
                  defaultLabel: e.target.value || undefined,
                })
              }
            >
              <option value="">(auto)</option>
              {pack.items.map((it) => (
                <option key={it.id} value={it.label}>
                  {it.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        {profile ? (
          <span className={styles.meta}>
            {profile.label} · {pack.items.length}/{profile.slots.length || "?"}
          </span>
        ) : (
          <span className={styles.meta}>
            {pack.items.length} {pack.items.length === 1 ? "face" : "faces"}
          </span>
        )}
      </div>

      {showSlots && coreSlots.length > 0 ? (
        <div className={styles.grid} style={{ marginBottom: "0.65rem" }}>
          {coreSlots.map((slot) => {
            const hit = pack.items.find(
              (it) => normalizeLabel(it.label) === normalizeLabel(slot),
            );
            if (hit) return null;
            return (
              <button
                key={`ghost-${slot}`}
                type="button"
                className={styles.add}
                style={{ minHeight: "5rem", borderStyle: "dashed" }}
                title={`Add ${slot}`}
                onClick={() => {
                  slotLabelRef.current = slot;
                  fileRef.current?.click();
                }}
              >
                <span>+ {slot}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className={styles.hint} style={{ marginTop: 0, marginBottom: "0.35rem" }}>
        Drag faces to reorder. Double-click a strip thumb to jump here.
      </p>

      <div className={styles.grid}>
        {pack.items.map((it) => {
          const isDef =
            pack.defaultLabel !== undefined &&
            normalizeLabel(pack.defaultLabel) === normalizeLabel(it.label);
          const focused =
            focusLabel !== null &&
            focusLabel !== undefined &&
            normalizeLabel(focusLabel) === normalizeLabel(it.label);
          const over = dragOverId === it.id;
          return (
            <div
              key={it.id}
              id={`sp-slot-${normalizeLabel(it.label)}`}
              className={`${styles.slot}${focused ? ` ${styles.slotFocus}` : ""}${over ? ` ${styles.slotDrag}` : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(it.id);
              }}
              onDragLeave={() => {
                setDragOverId((cur) => (cur === it.id ? null : cur));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdRef.current;
                setDragOverId(null);
                if (from) reorder(from, it.id);
                dragIdRef.current = null;
              }}
            >
              <div
                className={styles.preview}
                title="Drag to reorder"
                draggable
                onDragStart={() => {
                  dragIdRef.current = it.id;
                }}
                onDragEnd={() => {
                  dragIdRef.current = null;
                  setDragOverId(null);
                }}
              >
                {it.ref ? (
                  <img src={it.ref} alt={it.label} draggable={false} />
                ) : (
                  <span className={styles.ph}>?</span>
                )}
                {isDef ? <span className={styles.def}>Def</span> : null}
                {focused ? <span className={styles.focus}>Focus</span> : null}
              </div>
              <input
                className={styles.name}
                value={it.label}
                aria-label="Expression label"
                onChange={(e) => {
                  const label = e.target.value;
                  setItems(
                    pack.items.map((row) => (row.id === it.id ? { ...row, label } : row)),
                  );
                }}
              />
              <div className={styles.ops}>
                <button
                  type="button"
                  title="Set as default"
                  onClick={() => commit({ ...pack, defaultLabel: it.label })}
                >
                  Default
                </button>
                <button
                  type="button"
                  title="Replace image"
                  onClick={() => {
                    replaceIdRef.current = it.id;
                    fileRef.current?.click();
                  }}
                >
                  Replace
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => {
                    const items = pack.items.filter((row) => row.id !== it.id);
                    const next: SpritePackValue = { ...pack, items };
                    if (
                      pack.defaultLabel &&
                      normalizeLabel(pack.defaultLabel) === normalizeLabel(it.label)
                    ) {
                      next.defaultLabel = items[0]?.label;
                    }
                    commit(next);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className={styles.add}
          onClick={() => {
            replaceIdRef.current = null;
            slotLabelRef.current = null;
            fileRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropAdd}
        >
          <span>+ Add</span>
          <span>drop images</span>
        </button>
        <button
          type="button"
          className={styles.add}
          onClick={() => zipRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropAdd}
        >
          <span>ZIP</span>
          <span>import pack</span>
        </button>
      </div>

      <p className={styles.hint}>
        Label from filename. ZIP of images works. Same pack exports per host via Press.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple={allowMultiFile}
        className={styles.hidden}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        className={styles.hidden}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
