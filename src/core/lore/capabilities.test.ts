import { describe, expect, test } from "bun:test";
import {
  fieldVisible,
  loreFieldVisibility,
  parseWriteFor,
  LORE_WRITE_FOR_PROFILES,
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

  test("every profile has a visibility map", () => {
    for (const p of LORE_WRITE_FOR_PROFILES) {
      const m = loreFieldVisibility(p);
      expect(m.title).toBe("emphasize");
      expect(m.content).toBe("emphasize");
    }
  });

  test("agnai hides sticky; novelai emphasizes contextConfig", () => {
    expect(fieldVisible("agnai", "sticky")).toBe(false);
    expect(loreFieldVisibility("novelai").contextConfig).toBe("emphasize");
  });

  test("st-family emphasizes recursion; agnai demotes secondary triggers", () => {
    expect(loreFieldVisibility("st-family").recursion).toBe("emphasize");
    expect(loreFieldVisibility("agnai").secondaryTriggers).toBe("demote");
    // demote is still visible in UI (drawer can show); hide is not
    expect(fieldVisible("agnai", "secondaryTriggers")).toBe(true);
    expect(fieldVisible("agnai", "sideEffects")).toBe(false);
  });

  test("full profile shows the WHOLE RC wire - nothing hidden", () => {
    const m = loreFieldVisibility("full");
    for (const vis of Object.values(m)) expect(vis).not.toBe("hide");
    // the long-tail keys exist and are visible on full
    for (const key of [
      "comment",
      "triggerRiders",
      "groupTuning",
      "useMemo",
      "delayUntilRecursion",
      "characterFilter",
      "naiActivation",
    ] as const) {
      expect(fieldVisible("full", key)).toBe(true);
    }
  });

  test("profile shaping on the long tail: riders hidden for st-family, NAI cluster emphasized for novelai", () => {
    expect(fieldVisible("st-family", "triggerRiders")).toBe(false);
    expect(loreFieldVisibility("st-family").groupTuning).toBe("emphasize");
    expect(loreFieldVisibility("novelai").naiActivation).toBe("emphasize");
    expect(fieldVisible("agnai", "characterFilter")).toBe(false);
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
