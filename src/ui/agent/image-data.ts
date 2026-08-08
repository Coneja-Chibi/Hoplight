/**
 * Bytes into something an `img` tag can show, once, at the boundary.
 *
 * KIT HANDS PICTURES AROUND AS BYTES on purpose: the clipboard reader and the card-art seam have
 * different sources and neither should teach the command layer how to read a file. A browser cannot
 * take bytes, so exactly one place turns them into a `data:` URL, and that place also decides how
 * big a picture is allowed to be.
 *
 * THE TYPE IS SNIFFED, NOT ASSUMED. `showImage` carries no mime - Kit's terminal renderer decodes
 * the bytes itself - so labelling everything `image/png` would hand a browser a JPEG under the wrong
 * name. Browsers mostly cope; "mostly" is not a contract, and the four magic numbers below are the
 * whole of what any of these sources can produce.
 */

/**
 * KIT'S OWN CEILING, and it is deliberately not smaller.
 *
 * This was 2MB on the reasoning that a portrait is small. It is not: the first three cards in a real
 * studio measured 1.5MB, 1.7MB and 3.5MB, so `/art aphrodite` refused an ordinary picture and said
 * it was too large - technically true and completely useless. Kit's clipboard reader already caps at
 * this number, so anything that reaches here has passed it once; agreeing with it means the two
 * doors onto the same action refuse the same pictures.
 */
export const MAX_SHOWN_BYTES = 8 * 1024 * 1024;

/**
 * How much one shelf may carry in total.
 *
 * A SECOND, DIFFERENT LIMIT, because the failure it prevents is a different one. A single 8MB
 * portrait is fine; twelve of them is a hundred-megabyte response for a strip of thumbnails nobody
 * asked to see at full size. The gallery stops when it is full and says how many it showed.
 */
export const MAX_SHELF_BYTES = 24 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, magic: readonly number[]): boolean =>
  magic.every((byte, at) => bytes[at] === byte);

/** The image type these bytes actually are, or null when they are not an image this can show. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  // RIFF....WEBP: the four bytes at 8 are what separate a WebP from any other RIFF container.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  return null;
}

/**
 * A `data:` URL for these bytes, or null when there is nothing safe to show.
 *
 * Null rather than a placeholder: a picture that cannot be drawn is a fact the command should say in
 * words, and an empty frame says it worse.
 *
 * `declared` is what the source claimed - the art seam stores a mime alongside the bytes - and it is
 * used only when it agrees with what the bytes are. A stored label is authored data.
 */
export function imageDataUrl(bytes: Uint8Array, declared?: string): string | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SHOWN_BYTES) return null;
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) return null;
  const mime = declared === sniffed ? declared : sniffed;
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
