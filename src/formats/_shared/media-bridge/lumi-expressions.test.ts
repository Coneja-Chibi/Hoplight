/** Regression coverage for the lumi-expressions.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import {
  lumiExpressionsFromPack,
  packFromLumiExpressions,
  packsFromLumiGroups,
  lumiGroupsFromPacks,
} from "./lumi-expressions";

describe("lumi-expressions", () => {
  test("pack round-trip", () => {
    const pack = packFromLumiExpressions({
      enabled: true,
      defaultExpression: "happy",
      mappings: { happy: "data:a", sad: "data:b" },
    });
    expect(pack.items).toHaveLength(2);
    expect(pack.enabled).toBe(true);
    const back = lumiExpressionsFromPack(pack);
    expect(back.mappings?.happy).toBe("data:a");
    expect(back.defaultExpression).toBe("happy");
  });

  test("groups round-trip", () => {
    const packs = packsFromLumiGroups({
      groups: { Alice: { smile: "s1" }, Bob: { frown: "f1" } },
    });
    expect(Object.keys(packs)).toEqual(["Alice", "Bob"]);
    const wire = lumiGroupsFromPacks(packs);
    expect(wire.groups.Alice?.smile).toBe("s1");
  });
});
