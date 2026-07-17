/**
 * TrackerCardColors - Marinara tracker panel paint config on the character card
 * (`extensions.trackerCardColors`). Mirrors TrackerCardColorConfig: mode + display/accent/surface
 * colors and opacities + portrait stage knobs. Object in/out (not a JSON string).
 */
import type { JSX } from "react";
import { FieldForm, type FormField } from "../field-form";
import { SwatchRow, HOUSE_PALETTE } from "../swatch-row";
import styles from "./styles.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export interface TrackerCardColorsProps {
  value: unknown;
  onChange(next: Rec): void;
}

const MODE_FIELDS: readonly FormField[] = [
  {
    key: "mode",
    label: "Mode",
    kind: "select",
    options: [
      { value: "default", label: "Default" },
      { value: "chat", label: "Match chat colors" },
      { value: "custom", label: "Custom" },
    ],
  },
];

const TOGGLE_FIELDS: readonly FormField[] = [
  { key: "displayEnabled", label: "Display paint", kind: "toggle", half: true },
  { key: "accentEnabled", label: "Accent paint", kind: "toggle", half: true },
  { key: "surfaceEnabled", label: "Surface paint", kind: "toggle", half: true },
];

const OPACITY_FIELDS: readonly FormField[] = [
  { key: "nameColorOpacity", label: "Display opacity", kind: "slider", min: 0, max: 100, half: true },
  { key: "dialogueColorOpacity", label: "Accent opacity", kind: "slider", min: 0, max: 100, half: true },
  { key: "boxColorOpacity", label: "Surface opacity", kind: "slider", min: 0, max: 100, half: true },
];

const MATERIAL_FIELDS: readonly FormField[] = [
  { key: "materialBrightness", label: "Material brightness", kind: "slider", min: 0, max: 100 },
  { key: "glowIntensity", label: "Glow intensity", kind: "slider", min: 0, max: 100 },
  { key: "contrastIntensity", label: "Contrast veil", kind: "slider", min: 0, max: 100 },
];

const PORTRAIT_FIELDS: readonly FormField[] = [
  {
    key: "portraitStageBackground",
    label: "Portrait stage",
    kind: "select",
    options: [
      { value: "ambient", label: "Ambient" },
      { value: "spotlight", label: "Spotlight" },
      { value: "soft", label: "Soft" },
      { value: "plain", label: "Plain" },
    ],
  },
  { key: "portraitFocusX", label: "Portrait focus X", kind: "slider", min: 0, max: 100, half: true },
  { key: "portraitFocusY", label: "Portrait focus Y", kind: "slider", min: 0, max: 120, half: true },
  { key: "portraitZoom", label: "Portrait zoom", kind: "number", min: 0.1, step: 0.05 },
];

function ColorLine({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(hex: string): void;
}): JSX.Element {
  return (
    <div className={styles.colorBlock}>
      <div className={styles.k}>{label}</div>
      <SwatchRow palette={HOUSE_PALETTE} value={value || undefined} onChange={onChange} allowCustom />
      <input
        className={styles.cssIn}
        value={value}
        placeholder="#hex or CSS color / gradient"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TrackerCardColors({ value, onChange }: TrackerCardColorsProps): JSX.Element {
  const v = rec(value);
  const set = (key: string, next: unknown): void => onChange({ ...v, [key]: next });

  return (
    <div className={styles.wrap}>
      <div className={styles.help}>
        Tracker panel paint for this character (Marinara trackerCardColors). Mode &quot;chat&quot; reuses chat
        name/dialogue/box colors.
      </div>
      <FieldForm fields={MODE_FIELDS} value={v} onChange={set} />
      <FieldForm fields={TOGGLE_FIELDS} value={v} onChange={set} />
      <ColorLine label="Display color" value={str(v.nameColor)} onChange={(c) => set("nameColor", c)} />
      <ColorLine label="Accent color" value={str(v.dialogueColor)} onChange={(c) => set("dialogueColor", c)} />
      <ColorLine label="Surface color" value={str(v.boxColor)} onChange={(c) => set("boxColor", c)} />
      <FieldForm fields={OPACITY_FIELDS} value={v} onChange={set} />
      <FieldForm fields={MATERIAL_FIELDS} value={v} onChange={set} />
      <FieldForm fields={PORTRAIT_FIELDS} value={v} onChange={set} />
    </div>
  );
}
