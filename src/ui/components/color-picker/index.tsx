/**
 * ColorPicker - the house on-brand HSV surface (saturation/value square, hue strip, hex field; no
 * OS dialog). Consumers: PaintPicker's solid mode (SwatchRow's custom tile, the setup accent step,
 * Settings Appearance, later the editor's per-entity accent). The color math lives in
 * ../../_shared/color-math (pure, unit-tested); this component is the thin, controlled DOM around
 * it (transcribed 1:1 from the deleted _shared/color-picker.ts's createColorPicker).
 *
 * HSV, not hex, is this component's internal source of truth: hex is a LOSSY projection (hue and
 * saturation are unrecoverable at v=0 or s=0), so dragging value down to black and back up must
 * still remember the hue. `value` reconciles in only when it genuinely diverges from our own last
 * emit (a different preset picked, a different gradient stop selected); our own emits echo back
 * through `onChange` unchanged and are ignored, so a self-driven drag never resets mid-gesture.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, JSX, PointerEvent as ReactPointerEvent } from "react";
import { dragFraction, hexToHsv, hsvToHex, normalizeHex, type Hsv } from "../../_shared/color-math";
import styles from "./styles.module.css";

export interface ColorPickerProps {
  value?: string;
  onChange(hex: string): void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps): JSX.Element {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value ?? "#e11d48"));
  const [hexDraft, setHexDraft] = useState(() => hsvToHex(hsv));
  const hexFocused = useRef(false);

  useEffect(() => {
    const norm = normalizeHex(value ?? "");
    if (!norm || norm === hsvToHex(hsv)) return; // our own echo; keep the in-progress hue/saturation
    setHsv(hexToHsv(norm));
    if (!hexFocused.current) setHexDraft(norm);
  }, [value]);

  const emit = (next: Hsv): void => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexDraft(hex);
    onChange(hex);
  };

  const dragSv = (rect: DOMRect, clientX: number, clientY: number): void => {
    emit({
      ...hsv,
      s: dragFraction(clientX, rect.left, rect.width),
      v: 1 - dragFraction(clientY, rect.top, rect.height),
    });
  };
  const dragHue = (rect: DOMRect, clientX: number): void => {
    emit({ ...hsv, h: dragFraction(clientX, rect.left, rect.width) * 360 });
  };

  const onSvPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onSvPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.buttons === 0) return;
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onHuePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };
  const onHuePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.buttons === 0) return;
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };

  const onHexChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setHexDraft(e.target.value);
    const norm = normalizeHex(e.target.value);
    if (!norm) return; // tolerate mid-typing garbage; commit only a real color
    setHsv(hexToHsv(norm));
    onChange(norm);
  };

  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  return (
    <div className={styles.cp}>
      <div
        className={styles.sv}
        style={{
          background: `linear-gradient(to top,var(--stage-black),transparent),linear-gradient(to right,var(--stage-white),${pure})`,
        }}
        onPointerDown={onSvPointerDown}
        onPointerMove={onSvPointerMove}
      >
        <div className={styles.thumb} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <div className={styles.hue} onPointerDown={onHuePointerDown} onPointerMove={onHuePointerMove}>
        <div className={styles.thumb} style={{ left: `${(hsv.h / 360) * 100}%`, top: "50%" }} />
      </div>
      <div className={styles.foot}>
        <div className={styles.chip} style={{ background: current }} />
        <input
          className={styles.hex}
          spellCheck={false}
          aria-label="Hex color"
          value={hexDraft}
          onFocus={() => {
            hexFocused.current = true;
          }}
          onBlur={() => {
            hexFocused.current = false;
            setHexDraft(current);
          }}
          onChange={onHexChange}
        />
      </div>
    </div>
  );
}
