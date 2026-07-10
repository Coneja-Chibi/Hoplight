import { describe, expect, test } from "bun:test";
import {
  fieldVisible,
  loreFieldVisibility,
  parseWriteFor,
  LORE_WRITE_FOR_PROFILES,
  LORE_WRITE_FOR_LABELS,
} from "./capabilities";
import { loreSummary } from "./summary";
import { loreHealth } from "./health";
import { emptyLorebookBody } from "./empty-book";
import { sampleMatchEntries } from "./sample-match";

describe("lore capabilities", () => {
  test("parseWriteFor defaults to full", () => {
    expect(parseWriteFor(null)).toBe("full");
    expect(parseWriteFor("risu")).toBe("risu");
  });

  test("every profile has a visibility map and label", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      const m = loreFieldVisibility(p);
      expect(m.title).toBe("emphasize");
      expect(m.content).toBe("emphasize");
      expect(LORE_WRITE_FOR_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  test("full is Vaude card (no RC tab) and shows all first-class keys including specials", () => {
    expect(LORE_WRITE_FOR_LABELS.full.toLowerCase()).toContain("vaude");
    const m = loreFieldVisibility("full");
    for (const vis of Object.values(m)) expect(vis).not.toBe("hide");
    expect(fieldVisible("full", "displayIndex")).toBe(true);
    expect(fieldVisible("full", "matchOverrides")).toBe(true);
    expect(fieldVisible("full", "triggerRiders")).toBe(true);
    expect(fieldVisible("full", "specialTriggers")).toBe(true);
    expect(fieldVisible("full", "contextConfig")).toBe(true);
  });

  test("agnai keeps comment (wire has it); hides sticky (no wire)", () => {
    expect(fieldVisible("agnai", "comment")).toBe(true);
    expect(fieldVisible("agnai", "sticky")).toBe(false);
    expect(loreFieldVisibility("novelai").contextConfig).toBe("emphasize");
  });

  test("sillytavern shows displayIndex and timing; hides per-key riders and NAI assembly", () => {
    expect(fieldVisible("sillytavern", "displayIndex")).toBe(true);
    expect(loreFieldVisibility("sillytavern").recursion).toBe("emphasize");
    expect(fieldVisible("sillytavern", "triggerRiders")).toBe(false);
    expect(fieldVisible("sillytavern", "contextConfig")).toBe(false);
  });

  test("chub and lumiverse are their own lenses on the character-book floor, never smushed", () => {
    for (const p of ["chub", "lumiverse"] as const) {
      expect(LORE_WRITE_FOR_LABELS[p]).not.toContain("/");
      expect(fieldVisible(p, "secondaryTriggers")).toBe(true);
      expect(fieldVisible(p, "priority")).toBe(true);
      // ST-app-only fields have no chub/lumi wire home
      expect(fieldVisible(p, "scanSources")).toBe(false);
      expect(fieldVisible(p, "vectorized")).toBe(false);
      expect(fieldVisible(p, "automationId")).toBe(false);
    }
  });
});

describe("loreSummary / health", () => {
  test("empty book summary and health", () => {
    const b = emptyLorebookBody("Aetheria");
    b.entries = [];
    const s = loreSummary(b);
    expect(s.name).toBe("Aetheria");
    expect(s.entryCount).toBe(0);
    const h = loreHealth(b);
    expect(h.some((n) => n.code === "empty_book")).toBe(true);
  });

  test("counts keys and enabled", () => {
    const b = emptyLorebookBody("X");
    b.entries[0]!.triggers = [{ keyword: "dragon", isRegex: false }];
    b.entries[0]!.enabled = true;
    const s = loreSummary(b);
    expect(s.enabledCount).toBe(1);
    expect(s.keyCount).toBe(1);
  });
});

describe("sampleMatchEntries", () => {
  test("constant always matches; keyword primary", () => {
    const b = emptyLorebookBody();
    b.entries[0]!.constant = true;
    b.entries[0]!.title = "Always";
    const hits = sampleMatchEntries("hello", b.entries);
    expect(hits[0]!.matched).toBe("constant");

    b.entries[0]!.constant = false;
    b.entries[0]!.triggers = [{ keyword: "dragon", isRegex: false }];
    expect(sampleMatchEntries("the dragon flies", b.entries)[0]!.matched).toBe("primary");
    expect(sampleMatchEntries("no match", b.entries)[0]!.matched).toBe("none");
  });
});
