/**
 * Import expression images from a ZIP into a SpritePack. Pure after bytes are in hand.
 * Label = image basename. Uses bounded unzip (PACK_ARCHIVE_BOUNDS).
 */
import {
  labelFromFilename,
  newPackItemId,
  normalizePack,
  type SpritePackItem,
  type SpritePackValue,
} from "./pack";
import { isArchiveLimitError, PACK_ARCHIVE_BOUNDS, unzipBounded } from "../archive";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

const mimeFor = (ext: string): string => {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
};

const b64 = (u8: Uint8Array): string => Buffer.from(u8).toString("base64");

/**
 * @param zipBytes raw zip
 * @param base existing pack to merge into
 */
export function packFromZipBytes(
  zipBytes: Uint8Array,
  base?: SpritePackValue,
): SpritePackValue {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipBounded(zipBytes, {
      bounds: PACK_ARCHIVE_BOUNDS,
      filter: (file) => {
        const name = file.name.replace(/\\/g, "/");
        if (name.endsWith("/")) return false;
        const baseName = name.split("/").pop() ?? name;
        if (baseName.startsWith(".")) return false;
        const ext = baseName.split(".").pop()?.toLowerCase() ?? "";
        return IMAGE_EXT.has(ext);
      },
    });
  } catch (e) {
    if (isArchiveLimitError(e)) throw e;
    return normalizePack(base ?? { items: [] });
  }

  const added: SpritePackItem[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (!data || data.length === 0) continue;
    const baseName = path.replace(/\\/g, "/").split("/").pop() ?? path;
    const ext = baseName.split(".").pop()?.toLowerCase() ?? "png";
    const label = labelFromFilename(baseName);
    const ref = `data:${mimeFor(ext)};base64,${b64(data)}`;
    added.push({ id: newPackItemId(), label, ref, mime: mimeFor(ext) });
  }

  const existing = normalizePack(base ?? { items: [] });
  return normalizePack({
    ...existing,
    items: [...existing.items, ...added],
    defaultLabel: existing.defaultLabel ?? added[0]?.label,
  });
}
