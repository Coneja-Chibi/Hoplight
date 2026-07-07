/**
 * NativeCard - renders one platform's NATIVE fields (the extras it keeps to itself) as a card of real
 * controls, bound call-and-response to the entity's kept-whole original. Composes the reusable house
 * primitives (Slider, ToggleSwitch, and a compact note editor) so a platform's "everything else"
 * becomes editable instead of frozen. The schema TYPES live here (leaf layer); the per-platform
 * schema DATA lives in the editor (apps/workbench/native-fields.ts) and imports these.
 */
import { useState } from "react";
import type { JSX } from "react";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import { LinkOut } from "../link-out";
import { RawExtensions } from "../raw-extensions";
import { AssetManager, type Asset } from "../asset-manager";
import { StubEditor } from "../stub-editor";
import { TrackerSetup } from "../tracker-setup";
import { Recommendations } from "../recommendations";
import styles from "./styles.module.css";

/** an open stub-editor request: what to show while the real content-type editor does not exist yet */
interface Stub {
  title: string;
  note: string;
  view: JSX.Element;
}

/** Which reusable control renders a native field. Grown as each approved component lands. */
export type NativeControl =
  | "slider"
  | "toggle"
  | "note"
  | "lorebook-link" // an embedded lorebook object -> link to the Lorebook editor
  | "world-link" // a lorebook bound by name -> link to the Lorebook editor
  | "regex-link" // regex scripts array -> link to the Regex editor
  | "asset-manager" // data.assets[] -> the type-grouped media manager
  | "tracker-setup" // RoleCall trackerPreset -> the tracker module + seed editor
  | "recommendations" // RoleCall recommendations -> the 4-group bundle editor
  | "text" // a single line of text (a code, a name)
  | "url" // a URL
  | "read-only" // shown but not editable (account-level / derived fields)
  | "raw-extensions"; // the catch-all: every leftover key in this object, editable

export interface NativeField {
  /** dot path relative to entity.original */
  path: string;
  label: string;
  control: NativeControl;
  help?: string;
  slider?: { min: number; max: number; step?: number };
  /** raw-extensions only: extra keys to hide (already handled elsewhere, e.g. canonical fields) */
  hide?: readonly string[];
}

export interface NativeSchema {
  key: string;
  label: string;
  fields: NativeField[];
}

export interface NativeCardProps {
  schema: NativeSchema;
  /** read a value at a path relative to entity.original */
  read(path: string): unknown;
  /** write a value at a path relative to entity.original */
  write(path: string, value: unknown): void;
}

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const asRec = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

/** read-only rows for a stub editor's body (a lorebook's entries, a regex list) */
const stubRows = (items: unknown[], titleKey: string, bodyKey: string, fallbackName: string): JSX.Element => (
  <>
    {items.length === 0 ? (
      <div className={styles.help}>Nothing here yet.</div>
    ) : (
      items.map((it, i) => {
        const r = asRec(it) ?? {};
        const keys = Array.isArray(r.keys) ? r.keys.filter((k) => typeof k === "string").join(", ") : "";
        return (
          <div className={styles.stubEntry} key={i}>
            <div className={styles.stubKey}>{str(r[titleKey]) || keys || `${fallbackName} ${i + 1}`}</div>
            <div className={styles.stubText}>{str(r[bodyKey]).slice(0, 160) || "(empty)"}</div>
          </div>
        );
      })
    )}
  </>
);

function fieldControl(
  field: NativeField,
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
): JSX.Element {
  switch (field.control) {
    case "slider": {
      const s = field.slider ?? { min: 0, max: 1, step: 0.05 };
      return (
        <Slider
          value={num(read(field.path), s.min)}
          min={s.min}
          max={s.max}
          step={s.step ?? 1}
          onChange={(v) => write(field.path, v)}
          format={(v) => v.toFixed(2)}
          aria-label={field.label}
        />
      );
    }
    case "toggle": {
      const on = read(field.path) === true;
      return <ToggleSwitch on={on} onChange={(next) => write(field.path, next)} label={on ? "On" : "Off"} />;
    }
    case "note": {
      const p = field.path;
      return (
        <div className={styles.note}>
          <textarea
            className={styles.ta}
            value={str(read(`${p}.prompt`))}
            placeholder="Character's note..."
            onChange={(e) => write(`${p}.prompt`, e.target.value)}
          />
          <div className={styles.noterow}>
            <span className={styles.k}>Depth</span>
            <input
              className={styles.num}
              type="number"
              value={num(read(`${p}.depth`), 4)}
              onChange={(e) => write(`${p}.depth`, Number(e.target.value))}
            />
            <span className={styles.k}>Role</span>
            <select
              className={styles.sel}
              value={str(read(`${p}.role`)) || "system"}
              onChange={(e) => write(`${p}.role`, e.target.value)}
            >
              <option value="system">system</option>
              <option value="user">user</option>
              <option value="assistant">assistant</option>
            </select>
          </div>
        </div>
      );
    }
    case "lorebook-link": {
      const b = asRec(read(field.path));
      if (!b) return <LinkOut title="" empty emptyLabel="No embedded lorebook" />;
      const entries = Array.isArray(b.entries) ? b.entries : [];
      return (
        <LinkOut
          title={str(b.name) || "Embedded lorebook"}
          meta={`embedded - ${plural(entries.length, "entry")}`}
          action="Open in Lorebook editor"
          onAction={() =>
            openStub({
              title: `Lorebook: ${str(b.name) || "untitled"}`,
              note: "The full Lorebook editor is coming. Here is what this card carries, read-only.",
              view: stubRows(entries, "name", "content", "Entry"),
            })
          }
        />
      );
    }
    case "world-link": {
      const name = str(read(field.path));
      if (!name) return <LinkOut title="" empty emptyLabel="No linked world" />;
      return (
        <LinkOut
          title={name}
          meta="bound by name - resolves to your library"
          action="Open"
          onAction={() =>
            openStub({
              title: `Linked world: ${name}`,
              note: "This card binds a lorebook by name. The Lorebook editor and library picker are coming.",
              view: <div className={styles.help}>Resolves to a lorebook named &ldquo;{name}&rdquo; in your library.</div>,
            })
          }
        />
      );
    }
    case "regex-link": {
      const arr = read(field.path);
      const scripts = Array.isArray(arr) ? arr : [];
      if (scripts.length === 0) return <LinkOut title="" empty emptyLabel="No regex scripts" />;
      return (
        <LinkOut
          title={plural(scripts.length, "script") + " attached"}
          meta="card-scoped find/replace"
          action="Open in Regex editor"
          onAction={() =>
            openStub({
              title: "Regex scripts",
              note: "The full Regex editor is coming. Here is what this card carries, read-only.",
              view: stubRows(scripts, "scriptName", "findRegex", "Script"),
            })
          }
        />
      );
    }
    case "asset-manager": {
      const arr = read(field.path);
      return <AssetManager assets={Array.isArray(arr) ? (arr as Asset[]) : []} onChange={(next) => write(field.path, next)} />;
    }
    case "tracker-setup":
      return <TrackerSetup value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "recommendations":
      return <Recommendations value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "text":
      return <input className={styles.rowInput} value={str(read(field.path))} onChange={(e) => write(field.path, e.target.value)} />;
    case "url":
      return (
        <input
          className={styles.rowInput}
          type="url"
          value={str(read(field.path))}
          placeholder="https://..."
          onChange={(e) => write(field.path, e.target.value)}
        />
      );
    case "read-only":
      return <div className={styles.readonly}>{str(read(field.path)) || String(read(field.path) ?? "(none)")}</div>;
    case "raw-extensions":
      return <></>; // intercepted by NativeCard (needs schema context); never reached here
  }
}

export function NativeCard({ schema, read, write }: NativeCardProps): JSX.Element {
  const [stub, setStub] = useState<Stub | null>(null);
  return (
    <section className={styles.card}>
      <div className={styles.head}>{schema.label} fields</div>
      {stub ? (
        <StubEditor title={stub.title} note={stub.note} onClose={() => setStub(null)}>
          {stub.view}
        </StubEditor>
      ) : null}
      {schema.fields.map((f) => {
        // the catch-all needs schema context: hide the keys other fields already own
        if (f.control === "raw-extensions") {
          const prefix = `${f.path}.`;
          const handled = [
            ...schema.fields
              .filter((o) => o !== f && o.path.startsWith(prefix))
              .map((o) => o.path.slice(prefix.length))
              .filter((seg) => !seg.includes(".")), // direct children only
            ...(f.hide ?? []), // keys handled elsewhere (e.g. canonical fields under this object)
          ];
          return (
            <div className={styles.field} key={f.path}>
              <RawExtensions data={asRec(read(f.path)) ?? {}} handled={handled} onChange={(k, v) => write(`${f.path}.${k}`, v)} />
            </div>
          );
        }
        return (
          <div className={styles.field} key={f.path}>
            <div className={styles.label}>{f.label}</div>
            {f.help ? <div className={styles.help}>{f.help}</div> : null}
            {fieldControl(f, read, write, setStub)}
          </div>
        );
      })}
    </section>
  );
}
