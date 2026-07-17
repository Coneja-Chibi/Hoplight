/**
 * Chub expressions bridge: write expressions, keep sibling keys, do not mutate input.
 */
import { describe, expect, test } from "bun:test";
import { originalWithChubPack, packFromChubOriginal } from "./chub-expressions";

describe("chub-expressions bridge", () => {
  test("originalWithChubPack writes expressions and keeps full_path + sibling extensions", () => {
    const original = {
      sillytavern: {
        raw: {
          data: {
            name: "Keep me",
            extensions: {
              other_ns: { flag: true },
              chub: {
                full_path: "creator/slug",
                expressions: { old: "data:old" },
              },
            },
          },
        },
      },
    };
    const frozen = structuredClone(original);
    const next = originalWithChubPack(original, {
      items: [{ id: "1", label: "happy", ref: "data:image/png;base64,AA" }],
    });
    const data = (next as {
      sillytavern: { raw: { data: { name: string; extensions: Record<string, unknown> } } };
    }).sillytavern.raw.data;
    expect(data.name).toBe("Keep me");
    expect(data.extensions.other_ns).toEqual({ flag: true });
    const chub = data.extensions.chub as { full_path: string; expressions: Record<string, string> };
    expect(chub.full_path).toBe("creator/slug");
    expect(chub.expressions.happy).toBe("data:image/png;base64,AA");
    expect(chub.expressions.old).toBeUndefined();
    expect(original).toEqual(frozen);
  });

  test("packFromChubOriginal prefers expressions then alt_expressions", () => {
    const pack = packFromChubOriginal({
      sillytavern: {
        raw: {
          data: {
            extensions: {
              chub: {
                expressions: { joy: "j" },
                alt_expressions: { sad: "s" },
              },
            },
          },
        },
      },
    });
    expect(pack.items.map((i) => i.label)).toEqual(["joy"]);
  });
});
