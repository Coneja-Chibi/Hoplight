/**
 * Contract for reading a release's SHA256SUMS into committed helper pins.
 *
 * These hashes are the only thing between a download and an executed binary, and they are written once and
 * then trusted for a long time. So the parser's job is narrow on purpose: take the five helper assets and
 * nothing else, and refuse anything ambiguous instead of guessing.
 */
import { describe, expect, test } from "bun:test";
import { pinsFromChecksums, sidecarPinsModule } from "./sidecar-pin-format";
import { SIDECAR_TARGETS } from "../sidecar/build-targets";

const H = (n: string): string => n.repeat(64).slice(0, 64);
const TAG = "v0.1.27";

const realistic = [
  `${H("a")}  Hoplight.exe`,
  `${H("b")}  hoplight-cli-windows-x64.exe`,
  `${H("c")}  hoplight-kit-linux-x64`,
  `${H("d")}  sidecar-windows-x64.exe`,
  `${H("e")}  sidecar-linux-x64`,
  `${H("f")}  sidecar-linux-arm64`,
  `${H("1")}  sidecar-darwin-arm64`,
  `${H("2")}  sidecar-darwin-x64`,
].join("\n");

describe("reading SHA256SUMS", () => {
  test("takes the helper assets and keys them the way the app looks itself up", () => {
    const pins = pinsFromChecksums(realistic, TAG);
    expect(Object.keys(pins).sort()).toEqual(Object.keys(SIDECAR_TARGETS).sort());
    expect(pins["win32-x64"]).toEqual({
      asset: "sidecar-windows-x64.exe",
      sha256: H("d"),
      tag: TAG,
    });
  });

  test("IGNORES every other binary in the file", () => {
    // The checksum list also covers the app, the CLIs and Kit. Pinning those would be meaningless, and
    // taking whatever is listed would let an edited checksum file aim the downloader at any of them.
    const pins = pinsFromChecksums(realistic, TAG);
    const assets = Object.values(pins).map((p) => p.asset);
    expect(assets).not.toContain("Hoplight.exe");
    expect(assets).not.toContain("hoplight-cli-windows-x64.exe");
  });

  test("an unrelated asset that is not in the target table is never pinned", () => {
    const pins = pinsFromChecksums(`${H("9")}  sidecar-freebsd-riscv`, TAG);
    expect(pins).toEqual({});
  });

  test("tolerates CRLF, binary-mode stars and blank lines", () => {
    const pins = pinsFromChecksums(`\r\n${H("d")} *sidecar-windows-x64.exe\r\n\r\n`, TAG);
    expect(pins["win32-x64"]?.sha256).toBe(H("d"));
  });

  test("skips junk lines rather than aborting a legitimate pin", () => {
    const pins = pinsFromChecksums(`not a checksum line\n${H("e")}  sidecar-linux-x64\n`, TAG);
    expect(Object.keys(pins)).toEqual(["linux-x64"]);
  });

  test("a truncated or non-hex digest is not accepted as one", () => {
    expect(pinsFromChecksums(`deadbeef  sidecar-linux-x64`, TAG)).toEqual({});
    expect(pinsFromChecksums(`${H("A")}  sidecar-linux-x64`, TAG)).toEqual({});
  });

  test("two digests for one asset REFUSES rather than picking", () => {
    // The file is supposed to be the record of one release. Two answers means one of them is wrong, and
    // choosing between them would be arbitrary in the one place arbitrary is unacceptable.
    const doubled = `${H("d")}  sidecar-linux-x64\n${H("e")}  sidecar-linux-x64`;
    expect(() => pinsFromChecksums(doubled, TAG)).toThrow(/more than once/);
  });

  test("an empty file yields no pins, so nothing is offered", () => {
    expect(pinsFromChecksums("", TAG)).toEqual({});
  });
});

describe("the committed module it writes", () => {
  test("is a plain typed module, hand-readable for review", () => {
    const src = sidecarPinsModule(pinsFromChecksums(realistic, TAG), "Coneja-Chibi/Hoplight", TAG);
    expect(src).toContain('export const SIDECAR_REPO = "Coneja-Chibi/Hoplight"');
    expect(src).toContain("export const SIDECAR_PINS: SidecarPins = {");
    expect(src).toContain('"win32-x64"');
    expect(src).toContain(H("d"));
    expect(src).toContain('from "./aux-download"');
  });

  test("orders entries so a re-pin produces a reviewable diff, not a reshuffle", () => {
    const src = sidecarPinsModule(pinsFromChecksums(realistic, TAG), "r/r", TAG);
    const keys = [...src.matchAll(/^ {2}"([a-z0-9-]+)":/gm)].map((m) => m[1]);
    expect(keys).toEqual([...keys].sort());
  });

  test("records which release the pins came from", () => {
    expect(sidecarPinsModule(pinsFromChecksums(realistic, TAG), "r/r", TAG)).toContain(TAG);
  });
});
