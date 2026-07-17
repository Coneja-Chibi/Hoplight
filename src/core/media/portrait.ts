/**
 * Portrait / face helpers: build MediaAsset from a data URI or URL. Pure.
 */
import type { MediaAsset } from "../../entities/character/schema";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function mimeFromDataUri(dataUri: string): string | undefined {
  const m = /^data:([^;,]+)/.exec(dataUri);
  return m?.[1];
}

export function mimeFromUrl(url: string): string | undefined {
  const path = url.split("?")[0] ?? url;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  return undefined;
}

/** Build a primary portrait asset. Empty ref -> null (fail closed). */
export function portraitFromRef(ref: string, mime?: string): MediaAsset | null {
  const r = str(ref).trim();
  if (!r) return null;
  const out: MediaAsset = { role: "portrait", ref: r, primary: true };
  const m =
    mime ??
    (r.startsWith("data:") ? mimeFromDataUri(r) : mimeFromUrl(r));
  if (m) out.mime = m;
  return out;
}

/** True when ref is a usable face source for preview (data or http(s)). */
export function isPreviewablePortraitRef(ref: string): boolean {
  const r = ref.trim();
  return r.startsWith("data:image/") || r.startsWith("https://") || r.startsWith("http://");
}
