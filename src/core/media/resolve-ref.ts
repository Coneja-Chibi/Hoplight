/**
 * Resolve a media ref to something an <img>/<audio>/<video> can load.
 * Fail closed: unknown schemes and missing zip paths return null.
 * Pure: does not fetch network; only rewrites refs we already hold.
 */

export type AssetFileMap = ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>;

const MAX_PREVIEW_BYTES = 32 * 1024 * 1024;

const getFile = (files: AssetFileMap | undefined, key: string): Uint8Array | undefined => {
  if (!files) return undefined;
  if (files instanceof Map) return files.get(key) ?? files.get(key.replace(/^\//, ""));
  const rec = files as Record<string, Uint8Array>;
  return rec[key] ?? rec[key.replace(/^\//, "")];
};

const mimeFromPath = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  return "application/octet-stream";
};

const b64 = (u8: Uint8Array): string => {
  if (typeof Buffer !== "undefined") return Buffer.from(u8).toString("base64");
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
};

/**
 * @returns data: URL, https URL, or null when preview is not safe/possible.
 * Does not return blob: (caller may create blob URLs in the shell if needed).
 */
export function resolveAssetRef(ref: string, assetFiles?: AssetFileMap): string | null {
  const r = ref.trim();
  if (!r) return null;

  if (r.startsWith("data:")) return r;

  if (r.startsWith("https://") || r.startsWith("http://")) {
    // Allow http only for local previews of already-authored card URLs; still a string pass-through.
    return r;
  }

  if (r === "ccdefault:") return null;

  // Risu typo scheme embeded:// + correct embedded://
  const embed =
    r.startsWith("embeded://") ? r.slice("embeded://".length)
    : r.startsWith("embedded://") ? r.slice("embedded://".length)
    : null;
  if (embed !== null) {
    const bytes = getFile(assetFiles, embed) ?? getFile(assetFiles, `assets/${embed}`);
    if (!bytes || bytes.length === 0 || bytes.length > MAX_PREVIEW_BYTES) return null;
    return `data:${mimeFromPath(embed)};base64,${b64(bytes)}`;
  }

  // Archive-relative path (Lumi modules, charx)
  if (!r.includes("://") && (r.startsWith("assets/") || r.includes("/"))) {
    const bytes = getFile(assetFiles, r);
    if (!bytes || bytes.length === 0 || bytes.length > MAX_PREVIEW_BYTES) return null;
    return `data:${mimeFromPath(r)};base64,${b64(bytes)}`;
  }

  // Bare zip key
  const bare = getFile(assetFiles, r);
  if (bare && bare.length > 0 && bare.length <= MAX_PREVIEW_BYTES) {
    return `data:${mimeFromPath(r)};base64,${b64(bare)}`;
  }

  return null;
}

export const PREVIEW_MAX_BYTES = MAX_PREVIEW_BYTES;
