/**
 * The house color math - pure, unit-tested, framework-free. Extracted out of the old
 * _shared/color-picker.ts (CONTRACT V2/ADR-008: the DOM half moved to
 * src/ui/components/color-picker, a React component; only the math stays a plain module so
 * src/ui/_shared/paint.ts - and anything else that needs hex handling without a picker - can import
 * it without pulling in react). Functional core: normalizeHex/hexToHsv/hsvToHex convert between hex
 * and HSV (fail-closed on garbage); dragFraction is the pointer-drag fraction math shared by the
 * SV square, the hue strip, and the gradient stop rail.
 */

export interface Hsv {
  /** hue 0-360 */
  h: number;
  /** saturation 0-1 */
  s: number;
  /** value 0-1 */
  v: number;
}

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Coerce user hex into "#rrggbb" lowercase, or null when it is not a color (fail closed). */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  return /^[0-9a-f]{6}$/.test(full) ? `#${full}` : null;
}

/**
 * Pick a legible ink (near-black or cream) to sit ON a solid hex fill, by WCAG relative luminance.
 * Used for monogram badges: the tile wears a brand color, the letter must stay readable on it. Tolerant:
 * an unparseable fill reads as dark, so it gets cream ink.
 */
export const readableInk = (fill: string): string => {
  const hex = normalizeHex(fill) ?? "#000000";
  const lin = (pair: string): number => {
    const s = parseInt(pair, 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(hex.slice(1, 3)) + 0.7152 * lin(hex.slice(3, 5)) + 0.0722 * lin(hex.slice(5, 7));
  return lum > 0.42 ? "#0a0a0b" : "#faf8f3";
};

/** Hex -> HSV. Tolerant: an unparseable value reads as black (never throws). */
export function hexToHsv(hex: string): Hsv {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** HSV -> "#rrggbb". Clamps every axis; the inverse of hexToHsv within rounding. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const to = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Pure horizontal-drag fraction math: how far along [origin, origin+size) a pointer at `pos`
 * sits, clamped 0-1. Shared by the SV square (both axes), the hue strip, and the gradient stop
 * rail - each just feeds its own axis's clientX/clientY and rect origin/size. */
export function dragFraction(pos: number, origin: number, size: number): number {
  return size === 0 ? 0 : clamp01((pos - origin) / size);
}
