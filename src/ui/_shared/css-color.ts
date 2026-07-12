/**
 * Resolve a bare var(--token) color reference to its computed hex. Entity color fields are DATA
 * that export through codecs into foreign apps - a CSS variable string in one of them leaks
 * studio chrome into a foreign file. Anything that is not a bare var() reference, or a token the
 * live stylesheet cannot resolve, passes through unchanged (fail open to the input, never to a
 * made-up color).
 */
import { normalizeHex } from "./color-math";

const VAR_REF = /^var\((--[a-z0-9-]+)\)$/i;

export function resolveCssColor(value: string): string {
  const token = VAR_REF.exec(value.trim())?.[1];
  if (!token || typeof document === "undefined") return value;
  const computed = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return normalizeHex(computed) ?? value;
}
