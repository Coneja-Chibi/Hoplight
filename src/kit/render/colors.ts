/**
 * Shared color math for the render layer: hex parsing, ramp interpolation, darkening. Used by the
 * opening banner (flowing rainbow + stamp shadow) and the composer's color-shifting cursor.
 */

export const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, "0");

/** Interpolate a color ramp at t; wraps cyclically for t outside [0, 1). */
export const rampAt = (ramp: string[], t: number): string => {
  const scaled = ((((t % 1) + 1) % 1)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = hexToRgb(ramp[i]!);
  const b = hexToRgb(ramp[i + 1]!);
  return `#${toHex(a[0] + (b[0] - a[0]) * f)}${toHex(a[1] + (b[1] - a[1]) * f)}${toHex(a[2] + (b[2] - a[2]) * f)}`;
};

/** A darker variant of a color (each channel scaled by f). */
export const darken = (hex: string, f: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `#${toHex(r * f)}${toHex(g * f)}${toHex(b * f)}`;
};
