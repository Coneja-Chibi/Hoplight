/**
 * Named multipurpose assets hub (Risu additional assets: image/audio/video/font/css).
 * Pure: no React, no format ids.
 */

export type NamedAssetKind = "image" | "audio" | "video" | "font" | "css" | "other";

export type NamedAsset = {
  id: string;
  name: string;
  ref: string;
  kind: NamedAssetKind;
  mime?: string;
  ext?: string;
};

export type NamedAssetsValue = {
  items: readonly NamedAsset[];
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]);
const AUDIO = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);
const VIDEO = new Set(["mp4", "webm", "mov", "mkv"]);
const FONT = new Set(["ttf", "otf", "woff", "woff2"]);
const CSS = new Set(["css"]);

export const emptyNamed = (): NamedAssetsValue => ({ items: [] });

export const newNamedId = (): string =>
  `na_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function extFromNameOrRef(name: string, ref: string): string {
  const fromName = name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName !== name.toLowerCase() && fromName.length <= 5) return fromName;
  const path = ref.split("?")[0] ?? ref;
  if (path.startsWith("data:")) {
    const m = /^data:([^;,/]+)/.exec(path);
    if (m?.[1]?.includes("png")) return "png";
    if (m?.[1]?.includes("jpeg") || m?.[1]?.includes("jpg")) return "jpg";
    if (m?.[1]?.includes("webp")) return "webp";
    if (m?.[1]?.includes("gif")) return "gif";
    if (m?.[1]?.includes("mp3") || m?.[1]?.includes("mpeg")) return "mp3";
    if (m?.[1]?.includes("mp4")) return "mp4";
    if (m?.[1]?.includes("webm")) return "webm";
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext.length <= 5 ? ext : "";
}

export function kindFromExt(ext: string): NamedAssetKind {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (IMAGE.has(e)) return "image";
  if (AUDIO.has(e)) return "audio";
  if (VIDEO.has(e)) return "video";
  if (FONT.has(e)) return "font";
  if (CSS.has(e)) return "css";
  return "other";
}

export function kindFromMime(mime: string | undefined): NamedAssetKind | null {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("font") || mime.includes("woff") || mime.includes("ttf")) return "font";
  if (mime.includes("css")) return "css";
  return null;
}

/** Fail closed: require name + ref; unique names (last wins). */
export function normalizeNamed(value: unknown): NamedAssetsValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyNamed();
  const v = value as Record<string, unknown>;
  const raw = Array.isArray(v.items) ? v.items : [];
  const byName = new Map<string, NamedAsset>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const name = str(r.name).trim();
    const ref = str(r.ref).trim();
    if (!name || !ref) continue;
    const id = str(r.id).trim() || newNamedId();
    const mime = str(r.mime).trim() || undefined;
    const ext = str(r.ext).trim() || extFromNameOrRef(name, ref);
    const kind =
      (str(r.kind) as NamedAssetKind) &&
      ["image", "audio", "video", "font", "css", "other"].includes(str(r.kind))
        ? (str(r.kind) as NamedAssetKind)
        : (kindFromMime(mime) ?? kindFromExt(ext));
    const item: NamedAsset = { id, name, ref, kind };
    if (mime) item.mime = mime;
    if (ext) item.ext = ext;
    byName.set(name.toLowerCase(), item);
  }
  return { items: [...byName.values()] };
}
