import { describe, expect, test } from "bun:test";
import { matchExpression } from "./expression-match";
import { CORE_STARTER } from "./expression-profiles";

describe("matchExpression", () => {
  const pack = {
    items: [
      { id: "1", label: "happy", ref: "h" },
      { id: "2", label: "sad", ref: "s" },
      { id: "3", label: "neutral", ref: "n" },
    ],
    defaultLabel: "neutral",
  };

  test("happy keywords", () => {
    expect(matchExpression("She laughed and smiled.", pack, CORE_STARTER)).toBe("happy");
  });

  test("empty uses default", () => {
    expect(matchExpression("", pack, CORE_STARTER)).toBe("neutral");
  });
});
