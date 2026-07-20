/**
 * Cross-platform filename normalization for browser downloads and ZIP entries. This is filename
 * handling only: callers still mint extensions and enforce uniqueness at their own boundary.
 */

const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/** Return a safe filename base while retaining ordinary punctuation and authored spacing. */
export function sanitizeDownloadBase(raw: string, fallback: string): string {
  const normalized = (raw.trim() || fallback).replace(FORBIDDEN_FILENAME_CHARS, "_").slice(0, 80);
  const withoutTrailingDots = normalized.replace(/[. ]+$/g, "") || fallback;
  if (withoutTrailingDots === "." || withoutTrailingDots === "..") return `_${withoutTrailingDots}`;
  return WINDOWS_DEVICE_NAME.test(withoutTrailingDots) ? `_${withoutTrailingDots}` : withoutTrailingDots;
}
