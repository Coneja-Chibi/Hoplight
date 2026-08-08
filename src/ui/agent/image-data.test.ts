/**
 * Bytes into something a browser will draw, and the two ways that goes wrong quietly.
 *
 * A picture is the one thing on this wire with no upper bound of its own, and `showImage` carries no
 * mime at all - Kit's terminal decodes the bytes itself. Guessing PNG for everything works right up
 * until it does not, and the failure is a broken frame with nothing saying why.
 */
import { describe, expect, test } from "bun:test";
import { MAX_SHOWN_BYTES, imageDataUrl, sniffImageMime } from "./image-data";

const withHead = (head: readonly number[], length = 32): Uint8Array => {
  const bytes = new Uint8Array(length);
  bytes.set(head, 0);
  return bytes;
};

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

describe("what these bytes actually are", () => {
  test("the four formats these sources can produce", () => {
    expect(sniffImageMime(withHead(PNG))).toBe("image/png");
    expect(sniffImageMime(withHead(JPEG))).toBe("image/jpeg");
    expect(sniffImageMime(withHead([0x47, 0x49, 0x46, 0x38]))).toBe("image/gif");
    const webp = withHead([0x52, 0x49, 0x46, 0x46]);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(sniffImageMime(webp)).toBe("image/webp");
  });

  test("a RIFF container that is not WebP is not an image", () => {
    expect(sniffImageMime(withHead([0x52, 0x49, 0x46, 0x46]))).toBeNull();
  });

  test("anything else is nothing, rather than a hopeful png label", () => {
    expect(sniffImageMime(withHead([0x3c, 0x68, 0x74, 0x6d]))).toBeNull();
  });
});

describe("the data url", () => {
  test("A STORED LABEL DOES NOT OVERRIDE THE BYTES", () => {
    /**
     * The art seam stores a mime beside the picture, and that mime is authored data off somebody's
     * card. When it disagrees with the file, the file wins.
     */
    expect(imageDataUrl(withHead(JPEG), "image/png")?.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(imageDataUrl(withHead(PNG), "image/png")?.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("too big is null, so the command says so in words instead of drawing a hole", () => {
    expect(imageDataUrl(withHead(PNG, MAX_SHOWN_BYTES + 1))).toBeNull();
    expect(imageDataUrl(new Uint8Array(0))).toBeNull();
  });

  test("AN ORDINARY CARD PORTRAIT FITS", () => {
    /**
     * The cap was 2MB on the assumption that a portrait is small. The first three cards in a real
     * studio measured 1.5MB, 1.7MB and 3.5MB, so `/art aphrodite` refused a perfectly ordinary
     * picture. This is the size that was being turned away.
     */
    expect(imageDataUrl(withHead(PNG, 3_565_750))).not.toBeNull();
  });

  test("not an image is null", () => {
    expect(imageDataUrl(withHead([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});
