/**
 * Multi-platform lore field ownership: every Write-for profile must expose its wire surface.
 */
import { describe, expect, test } from "bun:test";
import { fieldVisible, loreFieldVisibility, LORE_WRITE_FOR_PROFILES, type LoreFieldKey } from "./capabilities";
import {
  LORE_ALL_POSITIONS,
  LORE_CORE_KEYS,
  PLATFORM_OWNED_EXTRAS,
  allPlatformFieldKeys,
  isDepthLikePosition,
  placementRailStops,
  placementRailVisible,
  platformOwnsField,
  positionsForProfile,
} from "./platform-fields";

describe("platform field ownership (all lore platforms)", () => {
  test("core keys are owned by every profile", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      for (const k of LORE_CORE_KEYS) {
        expect(platformOwnsField(p, k)).toBe(true);
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("full is the union: no key hidden", () => {
    const m = loreFieldVisibility("full");
    for (const k of allPlatformFieldKeys()) {
      expect(m[k]).not.toBe("hide");
      expect(fieldVisible("full", k)).toBe(true);
    }
  });

  test("sillytavern owns the ST worldinfo extras; hides RC/NAI-only clusters", () => {
    expect(fieldVisible("sillytavern", "sticky")).toBe(true);
    expect(fieldVisible("sillytavern", "displayIndex")).toBe(true);
    expect(fieldVisible("sillytavern", "scanSources")).toBe(true);
    expect(fieldVisible("sillytavern", "vectorized")).toBe(true);
    expect(fieldVisible("sillytavern", "triggerRiders")).toBe(false); // no per-key chance on ST wire
    expect(fieldVisible("sillytavern", "contextConfig")).toBe(false);
    expect(fieldVisible("sillytavern", "sideEffects")).toBe(false);
    expect(fieldVisible("sillytavern", "naiActivation")).toBe(false);
  });

  test("chub and lumiverse own the character-book floor; hide ST-app-only extras", () => {
    for (const p of ["chub", "lumiverse"] as const) {
      expect(fieldVisible(p, "secondaryTriggers")).toBe(true);
      expect(fieldVisible(p, "position")).toBe(true);
      expect(fieldVisible(p, "priority")).toBe(true);
      expect(fieldVisible(p, "scanSources")).toBe(false);
      expect(fieldVisible(p, "sticky")).toBe(false);
      expect(fieldVisible(p, "vectorized")).toBe(false);
      expect(fieldVisible(p, "displayIndex")).toBe(false);
    }
  });

  test("agnai owns weight/priority/comment/keywords; hides ST timing cluster", () => {
    expect(fieldVisible("agnai", "comment")).toBe(true);
    expect(fieldVisible("agnai", "priority")).toBe(true);
    expect(fieldVisible("agnai", "probability")).toBe(true);
    expect(fieldVisible("agnai", "secondaryTriggers")).toBe(true);
    expect(fieldVisible("agnai", "sticky")).toBe(false);
    expect(fieldVisible("agnai", "contextConfig")).toBe(false);
    expect(fieldVisible("agnai", "triggerRiders")).toBe(false);
  });

  test("risu owns folders, role, activation percent surface", () => {
    expect(fieldVisible("risu", "categoryId")).toBe(true);
    expect(fieldVisible("risu", "role")).toBe(true);
    expect(fieldVisible("risu", "probability")).toBe(true);
    expect(fieldVisible("risu", "contextConfig")).toBe(false);
    expect(fieldVisible("risu", "sideEffects")).toBe(false);
    expect(fieldVisible("risu", "specialTriggers")).toBe(false); // RC chips, not Risu wire
    expect(fieldVisible("risu", "triggerRiders")).toBe(false); // entry-level chance only
  });

  test("RC specials only on full card (RC is not a host tab)", () => {
    expect(fieldVisible("full", "specialTriggers")).toBe(true);
    for (const p of LORE_WRITE_FOR_PROFILES) {
      if (p === "full") continue;
      expect(fieldVisible(p, "specialTriggers")).toBe(false);
    }
  });

  test("novelai owns assembly + activation; hides ST groups/side effects", () => {
    expect(fieldVisible("novelai", "contextConfig")).toBe(true);
    expect(fieldVisible("novelai", "naiActivation")).toBe(true);
    expect(fieldVisible("novelai", "categoryId")).toBe(true);
    expect(fieldVisible("novelai", "sticky")).toBe(false);
    expect(fieldVisible("novelai", "sideEffects")).toBe(false);
    expect(fieldVisible("novelai", "scanSources")).toBe(false);
  });

  test("every PLATFORM_OWNED_EXTRAS key is visible on that profile", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      if (p === "full") continue;
      for (const k of PLATFORM_OWNED_EXTRAS[p]) {
        expect(fieldVisible(p, k)).toBe(true);
      }
    }
  });

  test("emphasis never hides a field", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      const m = loreFieldVisibility(p);
      for (const [k, vis] of Object.entries(m) as [LoreFieldKey, string][]) {
        if (!platformOwnsField(p, k)) expect(vis).toBe("hide");
        else expect(vis).not.toBe("hide");
      }
    }
  });
});

describe("injection positions per profile (grounded in codecs)", () => {
  test("full carries the whole canonical slot set, in display order", () => {
    expect(positionsForProfile("full")).toEqual([...LORE_ALL_POSITIONS]);
  });

  test("sillytavern carries exactly its numeric 0-4 slots; RC-only slots are foreign", () => {
    const st = positionsForProfile("sillytavern");
    expect(st).toEqual(["world", "character", "depth", "before_example", "after_example"]);
    expect(st).not.toContain("scene");
    expect(st).not.toContain("append");
    expect(st).not.toContain("prepend_top");
    expect(st).not.toContain("append_bottom");
  });

  test("character-book wires carry the before/after-char floor only", () => {
    for (const p of ["chub", "lumiverse", "agnai"] as const) {
      expect(positionsForProfile(p)).toEqual(["world", "character"]);
    }
  });

  test("risu and novelai have no position slot: character floor only", () => {
    expect(positionsForProfile("risu")).toEqual(["character"]);
    expect(positionsForProfile("novelai")).toEqual(["character"]);
  });

  test("every profile's slots are a subset of the canonical set and every profile is mapped", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      const slots = positionsForProfile(p);
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) expect(LORE_ALL_POSITIONS).toContain(s);
    }
  });
});

describe("placement rail stops (depth-like last)", () => {
  test("isDepthLikePosition marks depth and append only", () => {
    expect(isDepthLikePosition("depth")).toBe(true);
    expect(isDepthLikePosition("append")).toBe(true);
    expect(isDepthLikePosition("world")).toBe(false);
    expect(isDepthLikePosition("before_example")).toBe(false);
  });

  test("sillytavern: depth is last after before/after example", () => {
    expect(placementRailStops("sillytavern")).toEqual([
      "world",
      "character",
      "before_example",
      "after_example",
      "depth",
    ]);
  });

  test("full: all depth-like after non-depth", () => {
    const stops = placementRailStops("full");
    const firstDepth = stops.findIndex(isDepthLikePosition);
    expect(firstDepth).toBeGreaterThan(0);
    expect(stops.slice(firstDepth).every(isDepthLikePosition)).toBe(true);
    expect(stops.slice(0, firstDepth).some(isDepthLikePosition)).toBe(false);
  });

  test("foreign current is kept; depth-like foreign lands at end", () => {
    expect(placementRailStops("chub", "depth")).toEqual(["world", "character", "depth"]);
    expect(placementRailStops("chub", "scene")).toEqual(["world", "character", "scene"]);
  });

  test("rail visible only when profile has more than one stop", () => {
    expect(placementRailVisible("sillytavern")).toBe(true);
    expect(placementRailVisible("chub")).toBe(true);
    expect(placementRailVisible("risu")).toBe(false);
    expect(placementRailVisible("novelai")).toBe(false);
  });
});
