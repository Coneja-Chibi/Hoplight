/**
 * Paint - the reusable fill value model. A fill is either a solid color or a gradient (linear or
 * radial) of >=2 color stops. Everything that lets a user choose a fill speaks Paint, so the same
 * picker drives an accent, a card background, a pack cover, whatever. Pure: the model, its CSS
 * rendering, and a fail-closed parser for stored values. No DOM here.
 */
import { clamp01, normalizeHex } from "./color-picker";

export interface SolidPaint {
  kind: "solid";
  /** "#rrggbb" */
  color: string;
}

export interface GradientStop {
  /** "#rrggbb" */
  color: string;
  /** position along the gradient, 0-1 */
  at: number;
}

export interface GradientPaint {
  kind: "gradient";
  type: "linear" | "radial";
  /** gradient angle in degrees (linear only; ignored for radial) */
  angle: number;
  /** two or more stops, kept sorted by `at` */
  stops: GradientStop[];
}

export type Paint = SolidPaint | GradientPaint;

export const solidPaint = (color = "#e11d48"): SolidPaint => ({ kind: "solid", color });

/** A sensible starter gradient between two colors (used when a user flips solid -> gradient). */
export const gradientPaint = (from = "#e11d48", to = "#f59e0b"): GradientPaint => ({
  kind: "gradient",
  type: "linear",
  angle: 135,
  stops: [
    { color: from, at: 0 },
    { color: to, at: 1 },
  ],
});

const roundPct = (at: number): string => `${Math.round(clamp01(at) * 1000) / 10}%`;

/** Render a Paint as a CSS value usable anywhere a color or `background` is expected. */
export function paintToCss(p: Paint): string {
  if (p.kind === "solid") return p.color;
  const stops = [...p.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${roundPct(s.at)}`);
  if (p.type === "radial") return `radial-gradient(circle, ${stops.join(", ")})`;
  return `linear-gradient(${Math.round(p.angle)}deg, ${stops.join(", ")})`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseStop(raw: unknown): GradientStop | null {
  if (!isRecord(raw)) return null;
  const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? clamp01(raw.at) : null;
  return color && at !== null ? { color, at } : null;
}

/**
 * Fail-closed reader for a stored Paint (settings/escrow): anything malformed reads as null, and
 * the caller falls back to a default. Never throws, never trusts the shape.
 */
export function normalizePaint(raw: unknown): Paint | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === "solid") {
    const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
    return color ? { kind: "solid", color } : null;
  }
  if (raw.kind === "gradient") {
    const type = raw.type === "radial" ? "radial" : raw.type === "linear" ? "linear" : null;
    if (!type) return null;
    const angle = typeof raw.angle === "number" && Number.isFinite(raw.angle) ? raw.angle : 0;
    const stops = Array.isArray(raw.stops) ? raw.stops.map(parseStop).filter((s): s is GradientStop => s !== null) : [];
    if (stops.length < 2) return null; // a gradient needs at least two real stops
    return { kind: "gradient", type, angle: ((angle % 360) + 360) % 360, stops: stops.sort((a, b) => a.at - b.at) };
  }
  return null;
}
