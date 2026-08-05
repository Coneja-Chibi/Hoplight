/**
 * The rules that decide whether a keystroke means "paste a picture".
 *
 * Every one of these was wrong at some point and each failure was silent: the key did nothing and
 * looked like a feature that had not been built. The alt cases are the ones that cost the most, so
 * both spellings of alt are pinned rather than the one that happened to be checked first.
 */
import { describe, expect, test } from "bun:test";
import { isEmptyPaste, isImagePasteKey } from "./image-paste";

describe("isImagePasteKey", () => {
  test("alt+V under the kitty protocol", () => {
    expect(isImagePasteKey({ name: "v", option: true })).toBe(true);
  });

  test("alt+V under the ESC-prefix convention, which is what most terminals send", () => {
    // The case that was broken. opentui reports this one as `meta`, not `option`.
    expect(isImagePasteKey({ name: "v", meta: true })).toBe(true);
  });

  test("ctrl+G, the binding that needs no alt at all", () => {
    expect(isImagePasteKey({ name: "g", ctrl: true })).toBe(true);
  });

  test("ctrl+V, which only reaches us when the terminal did not claim it", () => {
    expect(isImagePasteKey({ name: "v", ctrl: true })).toBe(true);
  });

  test("a bare v is typing, not pasting", () => {
    expect(isImagePasteKey({ name: "v" })).toBe(false);
    expect(isImagePasteKey({ name: "g" })).toBe(false);
  });

  test("alt with any other letter is somebody else's binding", () => {
    expect(isImagePasteKey({ name: "b", meta: true })).toBe(false);
    expect(isImagePasteKey({ name: "b", option: true })).toBe(false);
  });
});

describe("isEmptyPaste", () => {
  test("no text means the clipboard held something else, most likely a picture", () => {
    expect(isEmptyPaste("")).toBe(true);
  });

  test("any text at all is a text paste, whatever else the clipboard holds", () => {
    expect(isEmptyPaste(" ")).toBe(false);
    expect(isEmptyPaste("hello")).toBe(false);
  });
});
