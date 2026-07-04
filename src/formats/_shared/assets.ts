/**
 * CCv3 `data.assets[]` -> canonical media. Shared by every format that serializes sprites/images
 * into the CCv3 asset array (RoleCall sprites, Risu .charx assets). Maps refs + roles + labels; the
 * actual bytes stay in each format's escrow. One owner so both adapters map assets identically.
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

/** CCv3 assets carry a bare extension ("png"), not a MIME type; derive the MIME, never store the ext. */
export const mimeFromExt = (ext: unknown): string | undefined =>
  typeof ext === "string" ? MIME_BY_EXT[ext.toLowerCase()] : undefined;

/** CCv3 asset `type` -> canonical role. Unknown/custom types (e.g. Risu "x-risu-asset") fall to "other". */
const ASSET_ROLE: Record<string, MediaAsset["role"]> = {
  icon: "portrait",
  emotion: "emotion",
  outfit: "outfit",
  pose: "pose",
  background: "background",
  user_icon: "other",
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
