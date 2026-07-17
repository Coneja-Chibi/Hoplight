/**
 * ExpressionMap <-> pack round-trip.
 */
import { describe, expect, test } from "bun:test";
import { expressionMapFromPack, packFromExpressionMap } from "./expression-map-bridge";

describe("expression-map-bridge", () => {
  test("round-trip mappings", () => {
    const map = {
      enabled: true,
      defaultExpression: "happy",
      mappings: { happy: "data:h", sad: "data:s" },
    };
    const pack = packFromExpressionMap(map);
    expect(pack.items.map((i) => i.label).sort()).toEqual(["happy", "sad"]);
    expect(pack.defaultLabel).toBe("happy");
    expect(pack.enabled).toBe(true);
    const back = expressionMapFromPack(pack);
    expect(back.mappings?.happy).toBe("data:h");
    expect(back.defaultExpression).toBe("happy");
    expect(back.enabled).toBe(true);
  });
});
