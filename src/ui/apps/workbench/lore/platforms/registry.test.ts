/** Regression coverage for the registry.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { cardsForLens, LORE_PLATFORM_CARDS } from "./registry";
import { cardVisible } from "./card-contract";

describe("lore platform cards", () => {
  test("every card names ONE platform - no smushed labels", () => {
    for (const card of LORE_PLATFORM_CARDS) {
      expect(card.label).not.toContain("/");
      expect(card.label.length).toBeGreaterThan(0);
    }
  });

  test("the Vaude lens surfaces every card", () => {
    expect(cardsForLens("full").map((c) => c.id)).toEqual(LORE_PLATFORM_CARDS.map((c) => c.id));
  });

  test("a platform lens surfaces only its own card", () => {
    expect(cardsForLens("sillytavern").map((c) => c.id)).toEqual(["sillytavern"]);
    expect(cardsForLens("novelai").map((c) => c.id)).toEqual(["novelai"]);
    expect(cardsForLens("risu").map((c) => c.id)).toEqual(["risu"]);
  });

  test("platforms with no long tail surface no cards (deny by absence)", () => {
    expect(cardsForLens("chub")).toEqual([]);
    expect(cardsForLens("lumiverse")).toEqual([]);
    expect(cardsForLens("agnai")).toEqual([]);
  });

  test("RoleCall has no lens of its own; the full card covers it", () => {
    const rc = LORE_PLATFORM_CARDS.find((c) => c.id === "rolecall")!;
    expect(rc.lenses).toEqual([]);
    expect(cardVisible(rc, "full")).toBe(true);
    expect(cardVisible(rc, "sillytavern")).toBe(false);
  });
});
