/**
 * SwatchRow - the house color-swatch row (transcribed 1:1 from the deleted _shared/swatches.ts's
 * swatchRow). Preset tiles are the fast path; with `allowCustom` a final "custom" tile opens
 * PaintPicker (solid mode) for any color. Consumers: the setup accent step, Settings Appearance,
 * later the editor's per-entity accent.
 *
 * Fully controlled, hex-only contract: `value` in, `onChange(hex)` out - the setup accent step
 * (src/ui/setup/steps/accent/index.tsx) already assumes exactly this shape.
 */
import { useState } from "react";
import type { JSX } from "react";
import { PaintPicker } from "../paint-picker";
import { solidPaint } from "../../_shared/paint";
import styles from "./styles.module.css";

export interface SwatchChoice {
  /** stable name ("rose") */
  id: string;
  /** label under the square (mono, lowercase by design) */
  label: string;
  /** the stored/applied hex */
  hex: string;
}

/** The authored house palette (locked vs-setup-hybrid). Entity accents may widen later. */
export const HOUSE_PALETTE: SwatchChoice[] = [
  { id: "rose", label: "rose", hex: "#e11d48" },
  { id: "amber", label: "amber", hex: "#f59e0b" },
  { id: "emerald", label: "emerald", hex: "#10b981" },
  { id: "violet", label: "violet", hex: "#8b5cf6" },
  { id: "blue", label: "blue", hex: "#3b82f6" },
];

const eq = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export interface SwatchRowProps {
  palette: SwatchChoice[];
  /** currently applied hex, if any */
  value?: string;
  onChange(hex: string): void;
  /** offer a custom-color tile after the presets (opens PaintPicker in solid mode) */
  allowCustom?: boolean;
}

export function SwatchRow({ palette, value, onChange, allowCustom }: SwatchRowProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const current = value ?? palette[0]?.hex ?? "#e11d48";
  const isCustom = !palette.some((c) => eq(c.hex, current));

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {palette.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={eq(choice.hex, current) ? `${styles.sw} ${styles.on}` : styles.sw}
            style={{ background: choice.hex }}
            title={choice.label}
            aria-pressed={eq(choice.hex, current)}
            onClick={() => onChange(choice.hex)}
          >
            <span className={styles.lbl}>{choice.label}</span>
          </button>
        ))}
        {allowCustom && (
          <button
            type="button"
            className={`${styles.sw} ${styles.custom} ${isCustom ? styles.on : styles.empty}`}
            style={isCustom ? { background: current } : undefined}
            title="Custom color"
            aria-pressed={isCustom}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={styles.lbl}>custom</span>
          </button>
        )}
      </div>
      {allowCustom && open && (
        <div className={styles.panel}>
          <PaintPicker
            value={solidPaint(current)}
            allow={["solid"]}
            onChange={(p) => {
              if (p.kind !== "solid") return;
              onChange(p.color);
            }}
          />
        </div>
      )}
    </div>
  );
}
