/**
 * PNG character-card codec: read/write the base64 `chara` (V2) and `ccv3` (V3) tEXt chunks.
 * Shared by every Tavern-lineage PNG format (SillyTavern, RoleCall). Adapted from RoleCall's
 * apps/rc/src/lib/formats/png/writer.ts - logic kept, DOM download helpers dropped, browser
 * btoa/atob swapped for Bun's Buffer.
 */
import extract from "png-chunks-extract";
import encode from "png-chunks-encode";
import text from "png-chunk-text";

const b64encode = (s: string): string => Buffer.from(s, "utf-8").toString("base64");
const b64decode = (b: string): string => Buffer.from(b, "base64").toString("utf-8");

const isTextChunk = (name: string): boolean => name === "tEXt" || name === "iTXt";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** True only if the bytes begin with the 8-byte PNG signature. */
function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  return true;
}

/** extract() but tolerant: non-PNG (or corrupt) bytes yield [] instead of throwing. */
function safeExtract(png: Uint8Array): ReturnType<typeof extract> {
  if (!isPng(png)) return [];
  try {
    return extract(png);
  } catch {
    return [];
  }
}

/**
 * The original sourceMedia twin for a PNG-carried card: the pixels are authored art, so every
 * Tavern-lineage PNG adapter keeps the carrier. Returns undefined for non-PNG input (tolerant).
 */
export function pngSourceMedia(bytes: Uint8Array | undefined): { b64: string; mime: string } | undefined {
  if (!bytes || !isPng(bytes)) return undefined;
  return { b64: Buffer.from(bytes).toString("base64"), mime: "image/png" };
}

/**
 * Return the decoded character JSON string from a PNG, or null if none present.
 *
 * A V3 card is normally written with BOTH chunks: `ccv3` carrying the full card and `chara` carrying
 * a V2 subset for older readers. Chunk order is not specified, so preferring whichever came first
 * would silently downgrade such a card to its subset. Prefer `ccv3` wherever it exists, matching
 * getVersion below; the two must never disagree about which chunk they are describing.
 */
export function extractCharacterJson(png: Uint8Array): string | null {
  let fallback: string | null = null;
  for (const chunk of safeExtract(png)) {
    if (!isTextChunk(chunk.name)) continue;
    try {
      const { keyword, text: value } = text.decode(chunk.data);
      if (keyword === "ccv3") return b64decode(value);
      if (keyword === "chara" && fallback === null) fallback = b64decode(value);
    } catch {
      continue;
    }
  }
  return fallback;
}

/** "v3" if a ccv3 chunk exists, else "v2" if a chara chunk exists, else null. */
export function getVersion(png: Uint8Array): "v2" | "v3" | null {
  let version: "v2" | "v3" | null = null;
  for (const chunk of safeExtract(png)) {
    if (!isTextChunk(chunk.name)) continue;
    try {
      const { keyword } = text.decode(chunk.data);
      if (keyword === "ccv3") return "v3";
      if (keyword === "chara") version = "v2";
    } catch {
      continue;
    }
  }
  return version;
}

/** Embed character JSON into a carrier PNG under the given keyword (default "chara"). */
export function embedCharacterJson(png: Uint8Array, json: string, keyword = "chara"): Uint8Array {
  const chunks = extract(png).filter((chunk) => {
    if (!isTextChunk(chunk.name)) return true;
    try {
      const { keyword: k } = text.decode(chunk.data);
      return k !== "chara" && k !== "ccv3";
    } catch {
      return true;
    }
  });
  const charaChunk = text.encode(keyword, b64encode(json));
  const iend = chunks.findIndex((c) => c.name === "IEND");
  if (iend !== -1) chunks.splice(iend, 0, charaChunk);
  else chunks.push(charaChunk);
  return encode(chunks);
}

const CANONICAL_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The card's portrait as raw PNG bytes, or null when it cannot carry one.
 *
 * A PNG CARD IS ITS PORTRAIT. Both adapters that write one need exactly this, and it was defined
 * privately in pygmalion while sillytavern - the format people actually trade PNGs in - could not
 * write one at all. Shared rather than copied: two readers of `data:` URLs drifting apart is how one
 * format quietly starts accepting a portrait the other rejects.
 *
 * INLINE PNG ONLY, and strictly. No fetching a remote ref, no transcoding another image type: an
 * export must not reach the network, and re-encoding pixels would make the round trip lossy without
 * saying so. The base64 is round-tripped before it is trusted, so a truncated or re-wrapped data URL
 * fails here rather than producing a corrupt carrier somebody discovers in another app.
 */
export function portraitPngBytes(body: { media: { portrait?: { ref?: unknown } } }): Uint8Array | null {
  const ref = body.media.portrait?.ref;
  if (typeof ref !== "string") return null;
  const match = /^data:image\/png;base64,(.+)$/i.exec(ref);
  const encoded = match?.[1];
  if (!encoded || encoded.length % 4 !== 0 || !CANONICAL_BASE64.test(encoded)) return null;
  try {
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.toString("base64") !== encoded) return null;
    const bytes = new Uint8Array(decoded);
    return pngSourceMedia(bytes) ? bytes : null;
  } catch {
    return null;
  }
}
