/**
 * Portrait extraction - pure reader that finds the displayable portrait inside a canonical entity.
 * Order of truth: (1) any original entry's sourceMedia image carrier (a PNG card's own pixels),
 * (2) a data-URI portrait in body.media. Tolerant: anything malformed reads as "no portrait".
 */
import type { CanonicalEntity } from "../core/canonical";

type AnyEntity = CanonicalEntity<string, unknown>;

export interface PortraitBytes {
  bytes: Uint8Array;
  mime: string;
}

const DATA_URI = /^data:([a-z0-9.+/-]+);base64,(.+)$/i;

/** Raster images only, fail closed: entity JSON is untrusted (imported cards), so the mime is an
 * ALLOWLIST, never trusted from the payload. SVG is excluded on purpose - it can carry scripts. */
const SAFE_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const isSafeImageMime = (mime: unknown): mime is string =>
  typeof mime === "string" && SAFE_IMAGE_MIMES.has(mime.toLowerCase());

const STRICT_B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function fromB64(b64: string, mime: string): PortraitBytes | null {
  // Buffer.from decodes sloppy base64 leniently; we fail closed instead of serving garbage bytes
  if (!STRICT_B64.test(b64)) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(b64, "base64"));
    return bytes.length > 0 ? { bytes, mime } : null;
  } catch {
    return null;
  }
}

/** True when the entity carries a displayable portrait (cheap check, no decoding). */
export function hasPortrait(entity: AnyEntity): boolean {
  return findPortraitSource(entity) !== null;
}

/** Decode the portrait bytes, or null when the entity carries none. */
export function portraitBytes(entity: AnyEntity): PortraitBytes | null {
  const src = findPortraitSource(entity);
  return src ? fromB64(src.b64, src.mime) : null;
}

function findPortraitSource(entity: AnyEntity): { b64: string; mime: string } | null {
  for (const entry of Object.values(entity.original ?? {})) {
    const media = entry?.sourceMedia;
    if (media && typeof media.b64 === "string" && media.b64 && isSafeImageMime(media.mime)) {
      return media;
    }
  }
  const body = entity.body as { media?: { portrait?: { ref?: unknown; mime?: unknown } } } | undefined;
  const ref = body?.media?.portrait?.ref;
  if (typeof ref === "string") {
    const m = DATA_URI.exec(ref);
    if (m && isSafeImageMime(m[1])) return { mime: m[1]!.toLowerCase(), b64: m[2]! };
  }
  return null;
}
