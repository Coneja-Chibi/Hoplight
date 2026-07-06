/**
 * PaintPicker - the reusable fill chooser (transcribed 1:1 from the deleted _shared/paint-picker.ts's
 * createPaintPicker). Composes ColorPicker to edit a solid color or each stop of a gradient. `allow`
 * gates the modes, so the same widget serves a solid-only accent (SwatchRow's custom tile) and a
 * full linear/radial gradient fill (a later per-entity/pack background). Fully controlled: unlike
 * ColorPicker, Paint round-trips losslessly through hex/stops, so the caller's `value` is the only
 * source of truth - only the selected gradient stop index is local, transient UI state.
 */
import { useState } from "react";
import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import { ColorPicker } from "../color-picker";
import { dragFraction, normalizeHex } from "../../_shared/color-math";
import {
  gradientPaint,
  paintToCss,
  normalizePaint,
  solidPaint,
  type GradientPaint,
  type GradientStop,
  type Paint,
} from "../../_shared/paint";
import styles from "./styles.module.css";

type Mode = "solid" | "gradient";

export interface PaintPickerProps {
  value?: Paint;
  /** which modes are offered (default both); a single mode hides the mode toggle */
  allow?: Mode[];
  onChange(paint: Paint): void;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");

/** Linear interpolation between two hex colors in RGB (good enough for a stop sampled off a bar). */
function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

/** The color the gradient shows at fraction f (for a new stop dropped on the bar). */
function sampleAt(stops: GradientStop[], f: number): string {
  const sorted = [...stops].sort((s1, s2) => s1.at - s2.at);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (f <= first.at) return first.color;
  if (f >= last.at) return last.color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i]!;
    const hi = sorted[i + 1]!;
    if (f >= lo.at && f <= hi.at) return lerpHex(lo.color, hi.color, (f - lo.at) / (hi.at - lo.at));
  }
  return last.color;
}

function clampToAllowed(paint: Paint, allow: Mode[]): Paint {
  if (paint.kind === "gradient" && !allow.includes("gradient")) return solidPaint(paint.stops[0]!.color);
  if (paint.kind === "solid" && !allow.includes("solid")) return gradientPaint(paint.color);
  return paint;
}

export function PaintPicker({ value, allow: allowProp, onChange }: PaintPickerProps): JSX.Element {
  const allow: Mode[] = allowProp?.length ? allowProp : ["solid", "gradient"];
  const paint = clampToAllowed(normalizePaint(value) ?? solidPaint(), allow);
  const [sel, setSel] = useState(0);
  const selClamped = paint.kind === "gradient" ? Math.min(sel, paint.stops.length - 1) : 0;

  const switchMode = (m: Mode): void => {
    if (paint.kind === m) return;
    setSel(0);
    onChange(
      m === "gradient"
        ? gradientPaint(paint.kind === "solid" ? paint.color : undefined)
        : solidPaint(paint.kind === "gradient" ? paint.stops[0]!.color : undefined),
    );
  };

  return (
    <div className={styles.pp}>
      {allow.length > 1 && (
        <div className={styles.modes}>
          {(["solid", "gradient"] as const)
            .filter((m) => allow.includes(m))
            .map((m) => (
              <button
                key={m}
                type="button"
                className={paint.kind === m ? styles.on : undefined}
                onClick={() => switchMode(m)}
              >
                {m}
              </button>
            ))}
        </div>
      )}
      {paint.kind === "solid" ? (
        <ColorPicker value={paint.color} onChange={(hex) => onChange({ kind: "solid", color: hex })} />
      ) : (
        <GradientEditor paint={paint} sel={selClamped} onSel={setSel} onChange={onChange} />
      )}
    </div>
  );
}

function GradientEditor({
  paint,
  sel,
  onSel,
  onChange,
}: {
  paint: GradientPaint;
  sel: number;
  onSel(i: number): void;
  onChange(p: Paint): void;
}): JSX.Element {
  const stop = paint.stops[sel]!;
  const withStops = (stops: GradientStop[]): GradientPaint => ({ ...paint, stops });

  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return; // a stop handle owns its own pointerdown
    const rect = e.currentTarget.getBoundingClientRect();
    const f = dragFraction(e.clientX, rect.left, rect.width);
    const stops = [...paint.stops, { color: sampleAt(paint.stops, f), at: f }];
    onSel(stops.length - 1);
    onChange(withStops(stops));
  };

  const dragStop = (i: number, bar: HTMLElement, clientX: number): void => {
    const rect = bar.getBoundingClientRect();
    const f = dragFraction(clientX, rect.left, rect.width);
    onChange(withStops(paint.stops.map((s, idx) => (idx === i ? { ...s, at: f } : s))));
  };

  const removeStop = (): void => {
    if (paint.stops.length <= 2) return;
    const stops = paint.stops.filter((_, i) => i !== sel);
    onSel(Math.min(sel, stops.length - 1));
    onChange(withStops(stops));
  };

  const barBg = `linear-gradient(90deg, ${[...paint.stops]
    .sort((a, b) => a.at - b.at)
    .map((s) => `${s.color} ${Math.round(s.at * 100)}%`)
    .join(", ")})`;

  return (
    <div className={styles.grad}>
      <div className={styles.bar} style={{ background: barBg }} onPointerDown={onBarPointerDown}>
        {paint.stops.map((s, i) => (
          <span
            key={i}
            className={i === sel ? `${styles.stop} ${styles.sel}` : styles.stop}
            style={{ left: `${s.at * 100}%`, background: s.color }}
            onPointerDown={(e) => {
              e.stopPropagation(); // don't let the bar add a new stop under the handle
              e.currentTarget.setPointerCapture(e.pointerId);
              onSel(i);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 0) return;
              e.stopPropagation();
              dragStop(i, e.currentTarget.parentElement as HTMLElement, e.clientX);
            }}
          />
        ))}
      </div>
      <div className={styles.row}>
        <div className={styles.out} style={{ background: paintToCss(paint) }} />
        <div className={styles.seg}>
          {(["linear", "radial"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={paint.type === t ? styles.on : undefined}
              onClick={() => onChange({ ...paint, type: t })}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" className={styles.rm} disabled={paint.stops.length <= 2} onClick={removeStop}>
          remove
        </button>
      </div>
      {paint.type === "linear" && (
        <div className={styles.angle}>
          <span className={styles.deg}>angle</span>
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(paint.angle)}
            onChange={(e) => onChange({ ...paint, angle: Number(e.target.value) })}
          />
          <span className={styles.deg}>{Math.round(paint.angle)}&deg;</span>
        </div>
      )}
      <ColorPicker
        value={stop.color}
        onChange={(hex) => onChange(withStops(paint.stops.map((s, i) => (i === sel ? { ...s, color: hex } : s))))}
      />
    </div>
  );
}
