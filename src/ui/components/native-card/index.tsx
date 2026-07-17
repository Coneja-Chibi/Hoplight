/**
 * NativeCard - renders one platform's NATIVE fields (the extras it keeps to itself) as a card of real
 * controls, bound call-and-response to the entity's kept-whole original. Composes the reusable house
 * primitives (Slider, ToggleSwitch, and a compact note editor) so a platform's "everything else"
 * becomes editable instead of frozen. The schema TYPES live in types.ts; control renderers in
 * field-control.tsx; the per-platform schema DATA lives in the editor platforms.
 */
import type { JSX } from "react";
import { RawExtensions } from "../raw-extensions";
import { StubEditor } from "../stub-editor";
import styles from "./styles.module.css";
import { asRec, fieldControl } from "./field-control";
import type {
  NativeControl,
  NativeField,
  NativeFieldContext,
  NativeSchema,
  Stub,
} from "./types";

export type {
  NativeControl,
  NativeField,
  NativeSchema,
  NativeFieldContext,
} from "./types";
export type { Stub };

/** rough card size per control, so a layout can bin-pack native cards (a big Tracker Setup should not
 * share a column with ten one-liners); big ones (>= 4) render full-span. */
const WEIGHT: Record<NativeControl, number> = {
  "tracker-setup": 5,
  recommendations: 5,
  "rpg-stats": 4,
  "tracker-card-colors": 4,
  "expression-map": 4,
  "expression-groups": 4,
  "alt-fields": 4,
  "portable-lora": 3,
  "asset-manager": 4,
  "avatar-crop": 4,
  "css-workshop": 5,
  json: 2,
  note: 2,
  textarea: 2,
  "raw-extensions": 2,
  "lorebook-link": 2,
  "regex-link": 2,
  "world-link": 1,
  slider: 1,
  toggle: 1,
  text: 1,
  color: 1,
  url: 1,
  "read-only": 1,
};

/** the body of one native field (help + control, or the schema-aware catch-all). */
function fieldBody(
  f: NativeField,
  schema: NativeSchema,
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
  ctx?: NativeFieldContext,
): JSX.Element {
  if (f.control === "raw-extensions") {
    const prefix = `${f.path}.`;
    const handled = [
      ...schema.fields
        .filter((o) => o !== f && o.path.startsWith(prefix))
        .map((o) => o.path.slice(prefix.length))
        .filter((seg) => !seg.includes(".")),
      ...(f.hide ?? []),
    ];
    return <RawExtensions data={asRec(read(f.path)) ?? {}} handled={handled} onChange={(k, v) => write(`${f.path}.${k}`, v)} />;
  }
  // css-workshop carries its own honesty banner; avoid duplicating help above it
  const showHelp = Boolean(f.help) && f.control !== "css-workshop";
  return (
    <>
      {showHelp ? <div className={styles.help}>{f.help}</div> : null}
      {fieldControl(f, read, write, openStub, ctx)}
    </>
  );
}

/**
 * One renderable native field with NO layout baked in: its label, platform pill text, size weight, and
 * rendered body. A layout wraps `body` however it likes (a bento card, a playbill row), so bento and
 * playbill share one definition instead of each hand-wiring the fields.
 */
export interface NativeFieldItem {
  key: string;
  label: string;
  platform: string;
  weight: number;
  big: boolean;
  body: JSX.Element;
}

/**
 * Every native field of a platform as renderable items. The caller owns the single stub-modal state for
 * the whole editor and passes openStub; render it with <StubEditor> (re-exported).
 */
export function nativeFieldItems(
  schema: NativeSchema,
  read: (p: string) => unknown,
  write: (p: string, v: unknown) => void,
  openStub: (s: Stub) => void,
  ctx?: NativeFieldContext,
): NativeFieldItem[] {
  return schema.fields.map((f) => {
    const weight = WEIGHT[f.control] ?? 1;
    return {
      key: `${schema.key}:${f.path}`,
      label: f.label,
      platform: schema.label,
      weight,
      big: weight >= 4,
      body: fieldBody(f, schema, read, write, openStub, ctx),
    };
  });
}

export { StubEditor };
