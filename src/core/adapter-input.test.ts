/**
 * The extension list is a detection contract, not a convenience: `text` present or absent changes
 * which adapter claims a file. These pin the cases the two former copies disagreed on.
 */
import { describe, expect, test } from "bun:test";
import { toAdapterInput } from "./adapter-input";

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

describe("toAdapterInput", () => {
  test("decodes the text extensions, including .lorebook", () => {
    // The drift that motivated this file: the CLI decoded json and txt but not lorebook, so the same
    // book was recognised through the studio and unrecognised through the command line.
    for (const name of ["book.json", "notes.txt", "world.lorebook"]) {
      expect(toAdapterInput(utf8('{"a":1}'), name).text).toBe('{"a":1}');
    }
  });

  test("leaves binary containers as bytes", () => {
    for (const name of ["card.png", "card.charx", "module.risum", "noextension"]) {
      expect(toAdapterInput(utf8("whatever"), name).text).toBeUndefined();
    }
  });

  test("reads the extension from a full path, not from a dotted folder name", () => {
    expect(toAdapterInput(utf8("{}"), "C:\\presets\\v1.2\\card.png").text).toBeUndefined();
    expect(toAdapterInput(utf8("{}"), "/home/me/v1.2/book.json").text).toBe("{}");
  });

  test("a .json file that is not UTF-8 keeps its bytes instead of throwing", () => {
    const input = toAdapterInput(new Uint8Array([0xff, 0xfe, 0x00]), "broken.json");
    expect(input.text).toBeUndefined();
    expect(input.bytes).toHaveLength(3);
  });

  test("a leading-dot name has no extension, matching node's extname", () => {
    expect(toAdapterInput(utf8("{}"), ".json").text).toBeUndefined();
  });
});
