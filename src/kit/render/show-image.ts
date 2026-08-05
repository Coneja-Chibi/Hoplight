/**
 * One door for putting a picture in the transcript.
 *
 * Three things want to draw an image now: the clipboard key, the /image command, and /art showing a
 * character's portrait. They must agree on the decode, the refusal, and the note, because the note is
 * the part that keeps the feature honest - an image that renders beautifully while the model has no
 * idea it exists is the worst version of this, since it looks like it worked.
 */
import { decodePngPixels } from "../../studio/signature-color";
import type { RenderLine } from "./turn-events";

/** Said out loud on every image: Kit's providers take text, so a picture is for the reader only. */
export const SHOWN_NOT_SENT = "shown to you only - Kit's providers take text, so this is not sent";

/**
 * The line to add for these bytes, or a refusal line explaining why not.
 *
 * Decoding is what proves the bytes are really an image before a renderer is handed them.
 * `decodePngPixels` fails closed on anything it does not understand, so something PNG-shaped but
 * broken becomes a sentence rather than a drawing surface throwing.
 */
export function imageLine(bytes: Uint8Array, note = SHOWN_NOT_SENT, source = "that image"): RenderLine {
  const pixels = decodePngPixels(bytes);
  if (!pixels) return { role: "watch", text: `${source} could not be read` };
  return { role: "image", bytes, width: pixels.width, height: pixels.height, note };
}
