/**
 * PNG chunk reader. The regression pinned here: a V3 card is normally written with BOTH a `ccv3`
 * chunk (the full card) and a `chara` chunk (a V2 subset for older readers). Chunk order is not
 * specified by the spec, so reading whichever appears first silently downgraded such a card to its
 * subset while getVersion, in the same file, still called it v3.
 */
import { describe, expect, test } from "bun:test";
import encode from "png-chunks-encode";
import text from "png-chunk-text";
import { extractCharacterJson, getVersion } from "./png";

const b64 = (s: string): string => Buffer.from(s, "utf-8").toString("base64");

/** A carrier PNG holding the given tEXt chunks, in the given order. */
const carrier = (entries: Array<[string, string]>): Uint8Array =>
  encode([
    { name: "IHDR", data: new Uint8Array(13) },
    ...entries.map(([keyword, value]) => text.encode(keyword, b64(value))),
    { name: "IEND", data: new Uint8Array(0) },
  ]);

const V3 = JSON.stringify({ spec: "chara_card_v3", data: { name: "Ada", nickname: "the full card" } });
const V2 = JSON.stringify({ spec: "chara_card_v2", data: { name: "Ada" } });

describe("extractCharacterJson: ccv3 wins over chara, whatever the chunk order", () => {
  test("reads the V3 card when chara is written first", () => {
    expect(extractCharacterJson(carrier([["chara", V2], ["ccv3", V3]]))).toBe(V3);
  });

  test("reads the V3 card when ccv3 is written first", () => {
    expect(extractCharacterJson(carrier([["ccv3", V3], ["chara", V2]]))).toBe(V3);
  });

  test("agrees with getVersion in both orders: never v3 by version but v2 by payload", () => {
    for (const order of [[["chara", V2], ["ccv3", V3]], [["ccv3", V3], ["chara", V2]]] as Array<Array<[string, string]>>) {
      const png = carrier(order);
      expect(getVersion(png)).toBe("v3");
      expect(extractCharacterJson(png)).toBe(V3);
    }
  });
});

describe("extractCharacterJson: the ordinary cases still hold", () => {
  test("a V2-only card falls back to chara", () => {
    const png = carrier([["chara", V2]]);
    expect(getVersion(png)).toBe("v2");
    expect(extractCharacterJson(png)).toBe(V2);
  });

  test("a ccv3-only card reads", () => {
    expect(extractCharacterJson(carrier([["ccv3", V3]]))).toBe(V3);
  });

  test("unrelated tEXt chunks are ignored, not mistaken for a card", () => {
    const png = carrier([["Software", "some editor"], ["chara", V2]]);
    expect(extractCharacterJson(png)).toBe(V2);
  });

  test("a PNG with no card chunk yields null, not a throw", () => {
    expect(extractCharacterJson(carrier([["Software", "some editor"]]))).toBeNull();
    expect(getVersion(carrier([]))).toBeNull();
  });

  test("non-PNG bytes are tolerated, not thrown on", () => {
    expect(extractCharacterJson(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(getVersion(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
