/**
 * PortableLora - Lumiverse card-side LoRA hint (not .safetensors install).
 * Wire: extensions.lumiverse_image_gen_lora
 * { version: 1, lora_filename, weight, base_tags?, source_url? }
 * source_url is display-only; never fetch.
 */
import type { JSX } from "react";
import { Slider } from "../slider";
import styles from "./styles.module.css";

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export interface PortableLoraValue {
  version: 1;
  lora_filename: string;
  weight: number;
  base_tags?: string;
  source_url?: string;
}

export interface PortableLoraProps {
  value: unknown;
  onChange(next: PortableLoraValue | null): void;
}

export function normalizePortableLora(value: unknown): PortableLoraValue | null {
  if (value === null || value === undefined) return null;
  const v = rec(value);
  const filename =
    str(v.lora_filename).trim() ||
    str(v.lora_name).trim(); // tolerate runtime-shaped keys if mirrored wrong
  if (!filename && !str(v.base_tags) && !str(v.source_url)) return null;
  return {
    version: 1,
    lora_filename: filename,
    weight: numOr(v.weight, numOr(v.weight_model, 1)),
    base_tags: str(v.base_tags) || undefined,
    source_url: str(v.source_url) || undefined,
  };
}

export function PortableLora({ value, onChange }: PortableLoraProps): JSX.Element {
  const v = normalizePortableLora(value) ?? {
    version: 1 as const,
    lora_filename: "",
    weight: 1,
  };

  const set = (patch: Partial<PortableLoraValue>): void => {
    const next = normalizePortableLora({ ...v, ...patch });
    onChange(next);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.warn}>
        Never auto-download source_url. Lumiverse treats it as display-only (safetensors phishing risk).
        Runtime Comfy/Swarm bind is host-local, not this field.
      </div>
      <label className={styles.lbl}>
        LoRA filename
        <input
          className={styles.input}
          value={v.lora_filename}
          placeholder="aerith_v3.safetensors"
          onChange={(e) => set({ lora_filename: e.target.value })}
        />
      </label>
      <div className={styles.row}>
        <span className={styles.k}>Weight</span>
        <Slider
          value={v.weight}
          min={0}
          max={2}
          step={0.05}
          onChange={(w) => set({ weight: w })}
          format={(n) => n.toFixed(2)}
          aria-label="LoRA weight"
        />
      </div>
      <label className={styles.lbl}>
        Base tags
        <textarea
          className={styles.ta}
          value={v.base_tags ?? ""}
          placeholder="optional positive prompt anchors"
          onChange={(e) => set({ base_tags: e.target.value })}
        />
      </label>
      <label className={styles.lbl}>
        Source URL (display only)
        <input
          className={styles.input}
          value={v.source_url ?? ""}
          placeholder="https://…"
          onChange={(e) => set({ source_url: e.target.value })}
        />
      </label>
      <button type="button" className={styles.clear} onClick={() => onChange(null)}>
        Clear LoRA hint
      </button>
    </div>
  );
}
