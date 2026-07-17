/**
 * Per-kind native field control renderers (slider, toggle, links, JSON, etc.).
 * Extracted from native-card/index.tsx so the public items factory stays thin.
 */
import { useEffect, useState, type JSX } from "react";
import { Slider } from "../slider";
import { ToggleSwitch } from "../toggle-switch";
import { LinkOut } from "../link-out";
import { AssetManager, type Asset } from "../asset-manager";
import { TrackerSetup } from "../tracker-setup";
import { Recommendations } from "../recommendations";
import { RpgStats } from "../rpg-stats";
import { AvatarCrop } from "../avatar-crop";
import { TrackerCardColors } from "../tracker-card-colors";
import { ExpressionMap } from "../expression-map";
import { ExpressionGroups } from "../expression-map/groups";
import { AltFields } from "../alt-fields";
import { PortableLora } from "../portable-lora";
import { CssWorkshop } from "../css-workshop";
import { SwatchRow, HOUSE_PALETTE } from "../swatch-row";
import styles from "./styles.module.css";
import type { NativeField, NativeFieldContext, Stub } from "./types";

export const num = (v: unknown, fallback: number): number =>
  (typeof v === "number" && Number.isFinite(v) ? v : fallback);
export const str = (v: unknown): string => (typeof v === "string" ? v : "");
export const asRec = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
export const plural = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

const jsonText = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
};

/** JSON textarea with local draft so mid-edit invalid JSON does not snap back. */
function JsonField({
  value,
  label,
  onCommit,
}: {
  value: unknown;
  label: string;
  onCommit(next: unknown): void;
}): JSX.Element {
  const [draft, setDraft] = useState(() => jsonText(value));
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setDraft(jsonText(value));
    setBad(false);
  }, [value]);
  return (
    <>
      <textarea
        className={styles.ta}
        value={draft}
        placeholder={label}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          setBad(false);
        }}
        onBlur={() => {
          const t = draft.trim();
          if (!t) {
            onCommit(null);
            setBad(false);
            return;
          }
          try {
            onCommit(JSON.parse(t) as unknown);
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
      {bad ? <div className={styles.help}>Invalid JSON. Fix it, then leave the field to save.</div> : null}
    </>
  );
}

/** read-only rows for a stub editor's body (a lorebook's entries, a regex list) */
const stubRows = (
  items: unknown[],
  titleKey: string,
  bodyKeys: string | readonly string[],
  fallbackName: string,
): JSX.Element => {
  const bodies = typeof bodyKeys === "string" ? [bodyKeys] : bodyKeys;
  return (
    <>
      {items.length === 0 ? (
        <div className={styles.help}>Nothing here yet.</div>
      ) : (
        items.map((it, i) => {
          const r = asRec(it) ?? {};
          const keys = Array.isArray(r.keys)
            ? r.keys.filter((k) => typeof k === "string").join(", ")
            : Array.isArray(r.keywords)
              ? r.keywords.filter((k) => typeof k === "string").join(", ")
              : "";
          const body = bodies.map((k) => str(r[k])).find((t) => t.length > 0) ?? "";
          return (
            <div className={styles.stubEntry} key={i}>
              <div className={styles.stubKey}>{str(r[titleKey]) || keys || `${fallbackName} ${i + 1}`}</div>
              <div className={styles.stubText}>{body.slice(0, 160) || "(empty)"}</div>
            </div>
          );
        })
      )}
    </>
  );
};

export function fieldControl(
  field: NativeField,
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
  ctx?: NativeFieldContext,
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
      const kind = str(b.kind) === "memory" ? "memory book" : "embedded";
      return (
        <LinkOut
          title={str(b.name) || "Embedded lorebook"}
          meta={`${kind} - ${plural(entries.length, "entry")}`}
          action="Open in Lorebook editor"
          onAction={() =>
            openStub({
              title: `Lorebook: ${str(b.name) || "untitled"}`,
              note: "The full Lorebook editor is coming. Here is what this card carries, read-only.",
              view: stubRows(entries, "name", ["content", "entry", "text"], "Entry"),
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
      return (
        <AssetManager
          assets={Array.isArray(arr) ? (arr as Asset[]) : []}
          onChange={(next) => write(field.path, next)}
          onOpenSprites={ctx?.onOpenSprites}
        />
      );
    }
    case "tracker-setup":
      return <TrackerSetup value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "recommendations":
      return <Recommendations value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "text": {
      const prior = read(field.path);
      const shown = typeof prior === "number" && Number.isFinite(prior) ? String(prior) : str(prior);
      return (
        <input
          className={styles.rowInput}
          value={shown}
          onChange={(e) => {
            const t = e.target.value;
            if (typeof prior === "number" && t !== "" && Number.isFinite(Number(t))) {
              write(field.path, Number(t));
              return;
            }
            write(field.path, t);
          }}
        />
      );
    }
    case "textarea":
      return <textarea className={styles.ta} value={str(read(field.path))} placeholder={field.label} onChange={(e) => write(field.path, e.target.value)} />;
    case "rpg-stats":
      return <RpgStats value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "avatar-crop":
      return (
        <AvatarCrop
          value={read(field.path)}
          onChange={(next) => write(field.path, next)}
          imageSrc={ctx?.portraitSrc}
        />
      );
    case "tracker-card-colors":
      return (
        <TrackerCardColors
          value={asRec(read(field.path)) ?? {}}
          onChange={(next) => write(field.path, next)}
        />
      );
    case "expression-map":
      return (
        <ExpressionMap value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />
      );
    case "expression-groups":
      return (
        <ExpressionGroups
          value={asRec(read(field.path)) ?? {}}
          onChange={(next) => write(field.path, next)}
        />
      );
    case "alt-fields":
      return <AltFields value={asRec(read(field.path)) ?? {}} onChange={(next) => write(field.path, next)} />;
    case "portable-lora":
      return <PortableLora value={read(field.path)} onChange={(next) => write(field.path, next)} />;
    case "color": {
      // Marinara allows CSS gradients on name/dialogue/box; swatches for solid hex, text for any CSS.
      const css = str(read(field.path));
      const hexForSwatch = /^#[0-9a-fA-F]{3,8}$/.test(css) ? css : undefined;
      return (
        <div className={styles.colorStack}>
          <SwatchRow
            palette={HOUSE_PALETTE}
            value={hexForSwatch}
            onChange={(hex) => write(field.path, hex)}
            allowCustom
          />
          <input
            className={styles.rowInput}
            value={css}
            placeholder="#hex or linear-gradient(...)"
            onChange={(e) => write(field.path, e.target.value)}
          />
        </div>
      );
    }
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
    case "css-workshop":
      return (
        <CssWorkshop
          value={str(read(field.path))}
          onChange={(css) => write(field.path, css)}
          defaultPackId={field.cssPack ?? "universal"}
          note={
            field.help ||
            "Sealed preview only. Vaude never applies this CSS to the app. Export keeps your full source for the host site."
          }
        />
      );
    case "json":
      return (
        <JsonField
          value={read(field.path)}
          label={field.label}
          onCommit={(next) => write(field.path, next)}
        />
      );
    case "read-only": {
      const v = read(field.path);
      let text = str(v);
      if (!text && v !== undefined && v !== null) {
        if (Array.isArray(v)) text = `${v.length} item${v.length === 1 ? "" : "s"} (on card twin)`;
        else if (asRec(v)) {
          const r = asRec(v)!;
          // Lumiverse expressions stub summary
          if (typeof r.enabled === "boolean" || asRec(r.mappings)) {
            const n = asRec(r.mappings) ? Object.keys(asRec(r.mappings)!).length : 0;
            text = `${r.enabled === true ? "enabled" : "off"} · ${n} mapping${n === 1 ? "" : "s"} (sprites home; twin kept)`;
          } else if (Object.keys(r).length > 0 && Object.values(r).every((x) => asRec(x) || (typeof x === "object" && x !== null))) {
            text = `${Object.keys(r).length} group${Object.keys(r).length === 1 ? "" : "s"} (sprites home; twin kept)`;
          } else text = `${Object.keys(r).length} key${Object.keys(r).length === 1 ? "" : "s"} (on card twin)`;
        } else text = String(v);
      }
      return <div className={styles.readonly}>{text || "(none)"}</div>;
    }
    case "raw-extensions":
      return <></>; // intercepted by NativeCard (needs schema context); never reached here
  }
}
