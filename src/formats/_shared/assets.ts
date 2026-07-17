/**
 * CCv3 `data.assets[]` <-> canonical media. Shared by every format that serializes sprites/images
 * into the CCv3 asset array (RoleCall sprites, Risu .charx assets, ST V3, Lumiverse). Maps refs +
 * roles + labels; the actual bytes stay in each format's original. One owner so adapters map assets
 * identically on read and write. Never fetches remote media or fabricates payload bytes.
 */
import type { Media, MediaAsset } from "../../entities/character/schema";

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

/** CCv3 assets carry a bare extension ("png"), not a MIME type; derive the MIME, never store the ext. */
export const mimeFromExt = (ext: unknown): string | undefined =>
  typeof ext === "string" ? MIME_BY_EXT[ext.toLowerCase()] : undefined;

/**
 * Derive a CCv3 `ext` from MIME and/or ref. Never invents "png" for unknown payloads.
 * Order: explicit mime -> data: URI mime -> path/URL extension.
 */
export function extFromMimeOrRef(mime?: string, ref?: string): string | undefined {
  if (mime) {
    const fromMime = EXT_BY_MIME[mime.toLowerCase().split(";")[0]!.trim()];
    if (fromMime) return fromMime;
  }
  const r = (ref ?? "").trim();
  if (!r) return undefined;

  if (r.startsWith("data:")) {
    const m = /^data:([^;,]+)/i.exec(r);
    if (m?.[1]) {
      const fromData = EXT_BY_MIME[m[1].toLowerCase()];
      if (fromData) return fromData;
    }
    return undefined;
  }

  const bare = r.split(/[?#]/)[0] ?? r;
  const seg = bare.split("/").pop() ?? bare;
  const dot = seg.lastIndexOf(".");
  if (dot > 0 && dot < seg.length - 1) {
    const ext = seg.slice(dot + 1).toLowerCase();
    if (MIME_BY_EXT[ext]) return ext === "jpeg" ? "jpg" : ext;
  }
  return undefined;
}

/** CCv3 asset `type` -> canonical role. Unknown/custom types (e.g. Risu "x-risu-asset") fall to "other". */
const ASSET_ROLE: Record<string, MediaAsset["role"]> = {
  icon: "portrait",
  emotion: "emotion",
  // real RoleCall emits expression sprites as type:"expression" (same concept as Risu "emotion")
  expression: "emotion",
  outfit: "outfit",
  pose: "pose",
  background: "background",
  user_icon: "other",
};

const ROLE_WIRE: Record<"outfit" | "pose" | "background", string> = {
  outfit: "outfit",
  pose: "pose",
  background: "background",
};

/** Wire dialect: RoleCall prefers expression; ST/Risu/Lumiverse prefer emotion. */
export type Ccv3MediaDialect = "sillytavern" | "rolecall" | "risu" | "lumiverse";

export type Ccv3AssetRow = {
  type?: string;
  uri?: string;
  name?: string;
  ext?: string;
  [key: string]: unknown;
};

export type MediaSkipReason = "empty-ref" | "private-ref" | "unrepresentable-other";

export type MediaMergeSkip = {
  reason: MediaSkipReason;
  asset: MediaAsset;
};

export type MediaMergeResult = {
  /** Merged assets array. When `unchanged`, this is the original `existing` reference. */
  assets: unknown;
  /** True when semantic media equals assetsToMedia(existing); original array shape retained. */
  unchanged: boolean;
  /** Assets intentionally not written (empty/private/unrepresentable). */
  skipped: MediaMergeSkip[];
};

export function assetsToMedia(assets: unknown): Media {
  if (!Array.isArray(assets)) return {};
  const mapped: MediaAsset[] = [];
  for (const a of assets) {
    if (!isRecord(a)) continue;
    const label = str(a.name);
    // "main" is the primary icon by convention even when the type is not spelled "icon".
    const role = label === "main" ? "portrait" : (ASSET_ROLE[String(a.type)] ?? "other");
    mapped.push({ role, label, ref: str(a.uri) ?? "", mime: mimeFromExt(a.ext) });
  }
  const portrait = mapped.find((m) => m.role === "portrait");
  if (portrait) portrait.primary = true;
  const rest = mapped.filter((m) => m !== portrait);

  const media: Media = {};
  if (portrait) media.portrait = portrait;
  if (rest.length) media.assets = rest;
  return media;
}

/** True when a ref cannot be a portable card-only URI without archive bytes. */
export function isPrivateArchiveRef(ref: string): boolean {
  const r = ref.trim();
  if (!r) return false;
  if (r.startsWith("data:")) return false;
  if (r.startsWith("https://") || r.startsWith("http://")) return false;
  if (r === "ccdefault:") return false;
  if (r.startsWith("embeded://") || r.startsWith("embedded://")) return true;
  if (r.startsWith("blob:") || r.startsWith("file:")) return true;
  // Archive-relative or bare path without a public scheme
  if (!r.includes("://")) return true;
  return false;
}

const emotionWireType = (dialect: Ccv3MediaDialect): "emotion" | "expression" =>
  dialect === "rolecall" ? "expression" : "emotion";

const labelOf = (a: { label?: string; name?: string }): string =>
  (a.label ?? a.name ?? "").trim();

/**
 * Stable semantic identity: role family + name. Emotion collapses emotion|expression.
 * Custom/other types match by name only so x-risu-asset/user_icon overlay by label.
 */
const rowKey = (type: string | undefined, name: string | undefined): string => {
  const n = (name ?? "").trim();
  if (n === "main" || type === "icon") return "portrait:main";
  const t = type ?? "";
  if (t === "emotion" || t === "expression") return `emotion:${n}`;
  if (t === "outfit" || t === "pose" || t === "background") return `${t}:${n}`;
  return `other:${n}`;
};

const mediaKey = (a: MediaAsset): string => {
  if (a.role === "portrait") return "portrait:main";
  if (a.role === "emotion") return `emotion:${labelOf(a)}`;
  if (a.role === "outfit" || a.role === "pose" || a.role === "background") {
    return `${a.role}:${labelOf(a)}`;
  }
  return `other:${labelOf(a)}`;
};

/** Flatten canonical media into a list of assets (portrait first). */
function flattenMedia(media: Media | undefined): MediaAsset[] {
  if (!media) return [];
  const out: MediaAsset[] = [];
  if (media.portrait) out.push(media.portrait);
  if (media.assets) out.push(...media.assets);
  return out;
}

/** Semantic compare for "untouched media" short-circuit (primary flag is read-derived). */
function mediaSemanticallyEqual(a: Media, b: Media): boolean {
  const flat = (m: Media): string[] =>
    flattenMedia(m)
      .map((x) => `${x.role}\0${labelOf(x)}\0${(x.ref ?? "").trim()}\0${x.mime ?? ""}`)
      .sort();
  const aa = flat(a);
  const bb = flat(b);
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

const wireTypeFor = (
  asset: MediaAsset,
  dialect: Ccv3MediaDialect,
  existingType: string | undefined,
): string => {
  if (asset.role === "portrait") return "icon";
  if (asset.role === "emotion") return emotionWireType(dialect);
  if (asset.role === "outfit" || asset.role === "pose" || asset.role === "background") {
    return ROLE_WIRE[asset.role];
  }
  // other: keep custom type from a matched existing row; else portable "other"
  if (
    existingType &&
    existingType !== "icon" &&
    existingType !== "emotion" &&
    existingType !== "expression" &&
    existingType !== "outfit" &&
    existingType !== "pose" &&
    existingType !== "background"
  ) {
    return existingType;
  }
  return "other";
};

/**
 * Inverse of assetsToMedia: project canonical media into a CCv3 assets[] array.
 * - Matches by semantic role/type + stable name, not array index.
 * - When semantic media equals assetsToMedia(existing), returns the original array untouched.
 * - Overlays known fields on matched rows; retains unknown keys on those rows.
 * - Media is authoritative: mapped rows absent from media are dropped; non-record junk is kept.
 * - Rejects empty refs. Skips unresolved private archive refs unless an existing row already
 *   carries the same uri (same-format residue).
 * - Does not fetch or fabricate bytes.
 */
export function mergeMediaIntoCcv3Assets(
  existing: unknown,
  media: Media | undefined,
  dialect: Ccv3MediaDialect,
): MediaMergeResult {
  const skipped: MediaMergeSkip[] = [];
  const fromExisting = assetsToMedia(existing);
  const want = media ?? {};

  if (mediaSemanticallyEqual(fromExisting, want)) {
    return { assets: existing, unchanged: true, skipped };
  }

  const existingRows: Ccv3AssetRow[] = Array.isArray(existing)
    ? existing.filter(isRecord).map((a) => ({ ...a }) as Ccv3AssetRow)
    : [];
  const junk: unknown[] = Array.isArray(existing) ? existing.filter((a) => !isRecord(a)) : [];

  const byKey = new Map<string, Ccv3AssetRow>();
  for (const row of existingRows) {
    const k = rowKey(str(row.type), str(row.name));
    if (!byKey.has(k)) byKey.set(k, row);
  }

  const out: Ccv3AssetRow[] = [];
  const emitted = new Set<string>();

  for (const asset of flattenMedia(want)) {
    const ref = (asset.ref ?? "").trim();
    if (!ref) {
      skipped.push({ reason: "empty-ref", asset });
      continue;
    }

    const k = mediaKey(asset);
    const match = byKey.get(k);
    const existingUri = str(match?.uri)?.trim() ?? "";

    // Private archive refs only survive when an existing row already carries the same uri.
    if (isPrivateArchiveRef(ref) && existingUri !== ref) {
      skipped.push({ reason: "private-ref", asset });
      continue;
    }

    const type = wireTypeFor(asset, dialect, str(match?.type));
    const name =
      asset.role === "portrait" ? "main" : (labelOf(asset) || str(match?.name) || "").trim();
    if (!name) {
      skipped.push({ reason: "empty-ref", asset });
      continue;
    }

    const ext = extFromMimeOrRef(asset.mime, ref) ?? str(match?.ext);

    if (match) {
      const next: Ccv3AssetRow = { ...match, type, uri: ref, name };
      if (ext !== undefined) next.ext = ext;
      else delete next.ext;
      out.push(next);
    } else {
      const next: Ccv3AssetRow = { type, uri: ref, name };
      if (ext !== undefined) next.ext = ext;
      out.push(next);
    }
    emitted.add(k);
  }

  // Non-record residue only; mapped content is fully owned by media.
  if (junk.length) return { assets: [...out, ...junk], unchanged: false, skipped };
  return { assets: out, unchanged: false, skipped };
}

/**
 * Apply mergeMediaIntoCcv3Assets onto a Tavern data bag. Mutates `data.assets` only when media
 * changed. Returns the merge result for honesty/warning callers.
 */
export function applyMediaToTavernData(
  data: { assets?: unknown },
  media: Media | undefined,
  dialect: Ccv3MediaDialect,
): MediaMergeResult {
  const result = mergeMediaIntoCcv3Assets(data.assets, media, dialect);
  if (result.unchanged) return result;
  const rows = result.assets;
  if (Array.isArray(rows) && rows.length > 0) {
    data.assets = rows;
  } else {
    delete data.assets;
  }
  return result;
}
