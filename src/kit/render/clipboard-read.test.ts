/**
 * The reveal boundary. Every test here is a REFUSAL, because this function hands a string to a
 * program and the failure it must not have is a path arriving as an option.
 */
import { describe, expect, test } from "bun:test";
import { revealInFolder } from "./clipboard-read";

describe("revealInFolder refuses anything that could be read as a flag", () => {
  test("a leading dash never reaches the helper", async () => {
    // `Bun.spawn` uses no shell, so quoting is not the risk - argv POSITION is. `open -R -W` would
    // hand `-W` to the program as an option rather than as the thing to reveal.
    for (const bad of ["-W", "--version", "-R", "-"]) {
      expect(await revealInFolder(bad)).toBe(false);
    }
  });

  test("a relative path is refused, which is what makes one check enough", async () => {
    // An absolute path cannot begin with a dash, so requiring absoluteness covers the whole class
    // without needing an end-of-options marker that these helpers parse inconsistently.
    for (const bad of ["cards/dite.png", "./dite.png", "../up.json", "dite.png"]) {
      expect(await revealInFolder(bad)).toBe(false);
    }
  });

  test("an empty path is refused rather than spawning anything", async () => {
    expect(await revealInFolder("")).toBe(false);
  });
});

describe("readClipboardImage refuses anything that is not really a PNG", () => {
  test("the magic bytes are checked, not the extension we chose", async () => {
    // A helper that failed quietly can leave a zero-length or half-written file behind. Trusting the
    // .png we named it would pass those bytes on to whatever decodes next, where the failure is
    // harder to read. The check lives here, at the boundary.
    const { readClipboardImage } = await import("./clipboard-read");
    const got = await readClipboardImage();
    // Whatever is on this machine's clipboard, the contract holds: either a real PNG, or null.
    if (got !== null) {
      expect(got.mime).toBe("image/png");
      expect([...got.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });
});
