/**
 * The starter blocks.
 *
 * Two risks. A skeleton that is subtly wrong teaches the mistake it was meant to prevent, and it
 * teaches it to everyone who copies it. And a starter set that fails our own coherence check would
 * be a poor advertisement for the check, so that is asserted rather than assumed.
 */
import { describe, expect, test } from "bun:test";
import { checkCoherence, type ClassifiedBlock } from "./coherence";
import { BLOCK_PATTERNS, findPattern } from "./patterns";
import { patternsWithSkeletons, skeletonFor, starterBlocks } from "./skeletons";

describe("skeletons", () => {
  test("the starter set satisfies the catalog's OWN ordering rules", () => {
    // The check and the starter kit come from the same catalog, so a disagreement between them is a
    // bug in one of the two, and either way it ships to whoever copies the blocks.
    const classified: ClassifiedBlock[] = starterBlocks().map((block) => ({
      identifier: block.identifier,
      name: block.name,
      enabled: true,
      pattern: BLOCK_PATTERNS.find((p) => skeletonFor(p.id)?.identifier === block.identifier)?.id,
    }));
    expect(checkCoherence(classified)).toEqual([]);
  });

  test("every skeleton says what to change, since a finished-sounding default gets shipped unedited", () => {
    for (const pattern of patternsWithSkeletons()) {
      const skeleton = skeletonFor(pattern.id)!;
      expect(skeleton.edit.length, pattern.id).toBeGreaterThan(20);
    }
  });

  test("a silent pattern's skeleton actually renders nothing", () => {
    // The distinction the whole catalog turns on. A variable-init that emitted its own text would
    // teach exactly the architectural mistake patterns.ts exists to prevent.
    for (const pattern of BLOCK_PATTERNS) {
      const skeleton = skeletonFor(pattern.id);
      if (!skeleton || pattern.emits !== "nothing") continue;
      const visible = skeleton.content
        .replace(/\{\{\/\/[^}]*\}\}/g, "")
        .replace(/\{\{setvar::[^}]*\}\}/g, "")
        .replace(/\{\{trim\}\}/g, "")
        .trim();
      expect(visible, `${pattern.id} emits visible text`).toBe("");
    }
  });

  test("the assembler reads what the option skeletons write", () => {
    // A starter kit whose assembler names different variables from its options renders empty
    // headings and looks like a broken engine rather than a broken example.
    const assembler = skeletonFor("assembler")!.content;
    for (const id of ["option-exclusive", "output-dials"]) {
      const written = skeletonFor(id)!.content.match(/\{\{setvar::([a-z_]+)::/)?.[1];
      expect(written, id).toBeTruthy();
      expect(assembler, `assembler does not read ${written}`).toContain(`{{getvar::${written}}}`);
    }
  });

  test("the additive skeleton appends rather than replacing", () => {
    // Without the read-then-write shape each enabled module silently erases the previous one.
    const content = skeletonFor("option-additive")!.content;
    expect(content).toContain("{{getvar::hp_modules}}");
    expect(content).toContain("{{setvar::hp_modules::");
  });

  test("the engine slot stays empty, because the engine fills it", () => {
    const slot = skeletonFor("engine-slot")!;
    expect(slot.content).toBe("");
    expect(slot.marker).toBe(true);
  });

  test("every skeleton belongs to a real pattern", () => {
    for (const pattern of patternsWithSkeletons()) {
      expect(findPattern(pattern.id)).toBeDefined();
    }
  });
});
