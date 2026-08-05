/**
 * The default has to be the mode that cannot break the frame.
 *
 * This is pinned rather than left to a constant because the failure it prevents was not a worse
 * picture: `auto` chose sixel, drew the image, and also spilled its payload into the cell buffer, so
 * the entire terminal filled with run-length sixel woven between the real rows. A change of default
 * here has to be a decision somebody made, not a line somebody edited.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { imageProtocol, usingRealProtocol } from "./image-protocol";

const KEY = "KIT_IMAGE_PROTOCOL";
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("imageProtocol", () => {
  test("defaults to blocks, which are ordinary characters and cannot desynchronise a redraw", () => {
    delete process.env[KEY];
    expect(imageProtocol()).toBe("blocks");
    expect(usingRealProtocol()).toBe(false);
  });

  test("every real mode can be asked for", () => {
    for (const mode of ["auto", "kitty", "sixel", "blocks"] as const) {
      process.env[KEY] = mode;
      expect(imageProtocol()).toBe(mode);
    }
  });

  test("case and spacing do not decide whether a terminal survives", () => {
    process.env[KEY] = "  SIXEL ";
    expect(imageProtocol()).toBe("sixel");
  });

  test("anything unrecognised falls to blocks rather than to auto", () => {
    // Fail toward the safe mode. A typo must not silently re-enable the one that broke the screen.
    for (const junk of ["", "yes", "true", "png", "iterm"]) {
      process.env[KEY] = junk;
      expect(imageProtocol()).toBe("blocks");
    }
  });
});
