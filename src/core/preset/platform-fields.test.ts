/**
 * The placement matrix (position-picker law) + the ownership helpers. Placements trace to RC's
 * PromptEditPanelV4 (its five) and ST's numeric injection_position (relative / in-chat only).
 */
import { describe, expect, test } from "bun:test";
import {
  allPresetFieldKeys,
  placementsForProfile,
  platformOwnsField,
  PRESET_ALL_PLACEMENTS,
  PRESET_CORE_KEYS,
  PRESET_PLACEMENT_LABELS,
} from "./platform-fields";
import { PRESET_WRITE_FOR_PROFILES } from "./capabilities";

describe("placement matrix", () => {
  test("rolecall + full carry all five placements in canonical order", () => {
    expect(placementsForProfile("full")).toEqual([...PRESET_ALL_PLACEMENTS]);
    expect(placementsForProfile("rolecall")).toEqual([...PRESET_ALL_PLACEMENTS]);
  });

  test("sillytavern + marinara carry only relative and in_chat", () => {
    expect(placementsForProfile("sillytavern")).toEqual(["relative", "in_chat"]);
    expect(placementsForProfile("marinara")).toEqual(["relative", "in_chat"]);
  });

  test("placementsForProfile preserves canonical order, never source order", () => {
    // a profile owning a later stop still gets it after the earlier ones
    const rc = placementsForProfile("rolecall");
    expect(rc.indexOf("relative")).toBeLessThan(rc.indexOf("in_chat"));
    expect(rc.indexOf("in_chat")).toBeLessThan(rc.indexOf("append"));
  });

  test("every placement has plain-language copy", () => {
    for (const stop of PRESET_ALL_PLACEMENTS) {
      expect(PRESET_PLACEMENT_LABELS[stop]?.label.length).toBeGreaterThan(0);
      expect(PRESET_PLACEMENT_LABELS[stop]?.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("ownership helpers", () => {
  test("core keys are owned by every profile including the leanest", () => {
    for (const key of PRESET_CORE_KEYS) {
      for (const p of PRESET_WRITE_FOR_PROFILES) {
        expect(platformOwnsField(p, key)).toBe(true);
      }
    }
  });

  test("full owns every known field key (it is the union)", () => {
    for (const key of allPresetFieldKeys()) {
      expect(platformOwnsField("full", key)).toBe(true);
    }
  });

  test("allPresetFieldKeys dedupes and includes the novel walkthrough key", () => {
    const keys = allPresetFieldKeys();
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("choices");
    expect(keys).toContain("xmlWrap");
  });
});
