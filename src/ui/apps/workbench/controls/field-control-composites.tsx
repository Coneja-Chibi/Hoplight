/**
 * Composite field bodies for list/keyvalue/subeditor/gallery and related kinds.
 * Extracted from field-control.tsx so the dispatcher stays under the line cap.
 */
import { useRef, useState, type JSX } from "react";
import { rec, str, strArr } from "../editor-derive";
import { readPath } from "../editor-core";
import { OptionCards } from "./option-cards";
import { ExpandTextarea } from "../../../components/expand";
import { VoiceSetup } from "../../../components/voice-setup";
import { StructuredPersona } from "../../../components/structured-persona";
import { ImagePromptEditor } from "../../../components/image-prompt";
import { SpriteParts } from "../../../components/sprite-parts";
import { ResponseSchema } from "../../../components/response-schema";
import type { FieldModule, SubField } from "../fields";
import type { FieldCtx } from "./field-control-ctx";

const ASSET_ROLES: readonly string[] = ["portrait", "emotion", "outfit", "pose", "background", "other"];

/** One file -> a gallery asset row; rejects on read failure so a bad file can never hang the add. */
const readAssetFile = (f: File): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ role: "other", ref: String(reader.result), mime: f.type, label: f.name });
    reader.onerror = () => reject(new Error(`gallery: could not read ${f.name}`));
    reader.readAsDataURL(f);
  });

/**
 * The asset gallery. A real component (not a render-switch case) because adding files is async:
 * the latest list lives in a ref so a read that lands after the user edited a row appends to the
 * CURRENT rows instead of clobbering them with the click-time snapshot, and each file settles
 * independently (allSettled) so one unreadable file skips with a note instead of hanging the add.
 */
function AssetGallery({
  styles,
  assets,
  setAssets,
}: {
  styles: Readonly<Record<string, string>>;
  assets: Record<string, unknown>[];
  setAssets: (next: Record<string, unknown>[]) => void;
}): JSX.Element {
  const latest = useRef(assets);
  latest.current = assets;
  const [readNote, setReadNote] = useState<string | null>(null);
  const update = (i: number, patch: Record<string, unknown>): void =>
    setAssets(assets.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addFiles = (files: FileList | null): void => {
    if (files === null || files.length === 0) return;
    setReadNote(null);
    void Promise.allSettled([...files].map(readAssetFile)).then((settled) => {
      const added = settled
        .filter((s): s is PromiseFulfilledResult<Record<string, unknown>> => s.status === "fulfilled")
        .map((s) => s.value);
      const failed = settled.length - added.length;
      if (added.length > 0) setAssets([...latest.current, ...added]);
      if (failed > 0) setReadNote(`${failed} file${failed === 1 ? "" : "s"} could not be read and ${failed === 1 ? "was" : "were"} skipped`);
    });
  };
  return (
    <div className={styles.gallery}>
      {assets.map((a, i) => {
        const ref = str(a.ref);
        const isImg = ref.startsWith("data:image") || ref.startsWith("http");
        return (
          <div className={styles.assetCard} key={i}>
            <div className={styles.assetThumb}>
              {isImg ? <img src={ref} alt="" /> : <span>{str(a.role) || "asset"}</span>}
            </div>
            <select className={styles.in} value={str(a.role)} onChange={(e) => update(i, { role: e.target.value })}>
              {ASSET_ROLES.map((rr) => (
                <option key={rr} value={rr}>{rr}</option>
              ))}
            </select>
            <input className={styles.in} placeholder="label" value={str(a.label)} onChange={(e) => update(i, { label: e.target.value })} />
            <div className={styles.assetRow}>
              <button
                type="button"
                className={`${styles.toggle}${a.primary === true ? ` ${styles.toggleOn}` : ""}`}
                onClick={() => update(i, { primary: a.primary !== true })}
              >
                Primary
              </button>
              <button type="button" className={styles.rm} onClick={() => setAssets(assets.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
          </div>
        );
      })}
      <label className={styles.add}>
        + add images
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {readNote && <p className={styles.sub ?? ""}>{readNote}</p>}
    </div>
  );
}

export function renderSub(
  styles: Readonly<Record<string, string>>,
  value: unknown,
  onChange: (v: unknown) => void,
  sf: SubField,
): JSX.Element {
  switch (sf.kind) {
    case "prose":
      return (
        <ExpandTextarea
          label={sf.label}
          className={`${styles.in} ${styles.ta}`}
          spellCheck={false}
          value={str(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <input
          className={styles.in}
          type="number"
          step={sf.number?.step}
          min={sf.number?.min}
          max={sf.number?.max}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "toggle":
      return (
        <button
          type="button"
          className={`${styles.toggle}${value === true ? ` ${styles.toggleOn}` : ""}`}
          aria-pressed={value === true}
          onClick={() => onChange(value !== true)}
        >
          {value === true ? "On" : "Off"}
        </button>
      );
    case "select":
      return (
        <select className={styles.in} value={str(value)} onChange={(e) => onChange(e.target.value)}>
          {(sf.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    default:
      return <input className={styles.in} placeholder={sf.placeholder} value={str(value)} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function compositeControlFor(
  ctx: FieldCtx,
  m: FieldModule,
  text: (path: string) => string,
): JSX.Element | null {
  const { draft, setField, styles } = ctx;

  switch (m.kind) {
    case "list": {
      const items = strArr(readPath(draft, m.path));
      return (
        <div className={styles.tags}>
          {items.map((it) => (
            <button
              key={it}
              type="button"
              className={styles.tag}
              style={{ color: "var(--text-dim)", borderColor: "var(--seam)", background: "transparent" }}
              title={`Remove ${it}`}
              onClick={() => setField(m.path, items.filter((x) => x !== it))}
            >
              {it} <i>x</i>
            </button>
          ))}
          <input
            className={styles.tagIn}
            placeholder="+ add, enter"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = e.currentTarget.value.trim();
              if (v === "") return;
              if (!items.includes(v)) setField(m.path, [...items, v]);
              e.currentTarget.value = "";
            }}
          />
        </div>
      );
    }
    case "select":
      return (
        <OptionCards
          options={(m.options ?? []).map((o) => ({ value: o.value, title: o.label }))}
          value={text(m.path)}
          onSelect={(v) => setField(m.path, v)}
          styles={styles}
        />
      );
    case "number": {
      const raw = readPath(draft, m.path);
      const n = typeof raw === "number" ? raw : undefined;
      const meta = m.number;
      if (meta?.range) {
        return (
          <div className={styles.numrange}>
            <input
              type="range"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={n ?? meta.min ?? 0}
              onChange={(e) => setField(m.path, Number(e.target.value))}
            />
            <span className={styles.numval}>{n === undefined ? "unset" : `${n}${meta.unit ?? ""}`}</span>
          </div>
        );
      }
      return (
        <input
          className={styles.in}
          type="number"
          step={meta?.step}
          min={meta?.min}
          max={meta?.max}
          value={n ?? ""}
          onChange={(e) => setField(m.path, e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    }
    case "keyvalue": {
      const entries = Object.entries(rec(readPath(draft, m.path)));
      const kv = m.keyValue ?? { keyLabel: "Key", valueLabel: "Value" };
      const isList = kv.valueList === true;
      const showVal = (v: unknown): string => (isList ? strArr(v).join(", ") : str(v));
      const parseVal = (s: string): unknown => (isList ? s.split(",").map((x) => x.trim()).filter(Boolean) : s);
      const write = (next: [string, unknown][]): void => setField(m.path, Object.fromEntries(next));
      return (
        <div className={styles.kv}>
          {entries.map(([k, v], i) => (
            <div className={styles.kvrow} key={i}>
              <input
                className={styles.in}
                placeholder={kv.keyPlaceholder ?? kv.keyLabel}
                value={k}
                onChange={(e) => write(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)))}
              />
              <input
                className={styles.in}
                placeholder={kv.valueLabel}
                value={showVal(v)}
                onChange={(e) => write(entries.map((en, j) => (j === i ? [en[0], parseVal(e.target.value)] : en)))}
              />
              <button type="button" className={styles.rm} onClick={() => write(entries.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
          ))}
          <button type="button" className={styles.add} onClick={() => write([...entries, ["", ""]])}>
            {`+ add ${kv.keyLabel.toLowerCase()}`}
          </button>
        </div>
      );
    }
    case "list-subeditor": {
      const raw = readPath(draft, m.path);
      const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw.map(rec) : [];
      const subs = m.subFields ?? [];
      const setRows = (next: Record<string, unknown>[]): void => setField(m.path, next);
      return (
        <div className={styles.sublist}>
          {rows.map((row, i) => (
            <div className={styles.subrow} key={i}>
              {subs.map((sf) => (
                <label className={styles.subcell} key={sf.key}>
                  <span className={styles.subk}>{sf.label}</span>
                  {renderSub(styles, row[sf.key], (v) => setRows(rows.map((r, j) => (j === i ? { ...r, [sf.key]: v } : r))), sf)}
                </label>
              ))}
              <button type="button" className={styles.rm} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                remove
              </button>
            </div>
          ))}
          <button type="button" className={styles.add} onClick={() => setRows([...rows, {}])}>
            {m.addLabel ?? "+ add"}
          </button>
        </div>
      );
    }
    case "structured-subeditor": {
      const obj = rec(readPath(draft, m.path));
      const subs = m.subFields ?? [];
      return (
        <div className={styles.structured}>
          {subs.map((sf) => (
            <label className={styles.subcell} key={sf.key}>
              <span className={styles.subk}>{sf.label}</span>
              {renderSub(styles, obj[sf.key], (v) => setField(`${m.path}.${sf.key}`, v), sf)}
            </label>
          ))}
        </div>
      );
    }
    case "asset-gallery":
      return (
        <AssetGallery
          styles={styles}
          assets={(() => {
            const raw = readPath(draft, m.path);
            return Array.isArray(raw) ? raw.map(rec) : [];
          })()}
          setAssets={(next) => setField(m.path, next)}
        />
      );
    case "voice-setup":
      return (
        <VoiceSetup
          value={readPath(draft, m.path)}
          onChange={(next) => setField(m.path, next)}
        />
      );
    case "structured-persona":
      return (
        <StructuredPersona
          value={readPath(draft, m.path)}
          onChange={(next) => setField(m.path, next)}
        />
      );
    case "image-prompt":
      return (
        <ImagePromptEditor
          value={readPath(draft, m.path)}
          onChange={(next) => setField(m.path, next)}
        />
      );
    case "sprite-parts":
      return (
        <SpriteParts
          value={readPath(draft, m.path)}
          onChange={(next) => setField(m.path, next)}
        />
      );
    case "response-schema":
      return (
        <ResponseSchema
          value={readPath(draft, m.path)}
          onChange={(next) => setField(m.path, next)}
        />
      );
    default:
      return null;
  }
}
