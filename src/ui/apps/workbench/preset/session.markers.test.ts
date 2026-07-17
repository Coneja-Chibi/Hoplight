/**
 * Marker slots. The invariant that matters: a slot is SINGULAR. Two chat-history markers is not a
 * duplicate row, it is a preset that cannot build - so the guard lives in the session op, not only
 * in the menu that greys the option out.
 */
import { describe, expect, test } from "bun:test";
import { addMarker, markerSlotName, newBlock, placedMarkerSlots } from "./session";
import type { PresetBody } from "../../../../entities/preset";

const base = (): PresetBody => ({ name: "P", prompts: [] });

describe("addMarker", () => {
  test("adds a marker block carrying the slot, not authored content", () => {
    const b = addMarker(base(), "chatHistory");
    expect(b.prompts).toHaveLength(1);
    const m = b.prompts[0]!;
    expect(m.marker).toBe(true);
    expect(m.markerSlot).toBe("chatHistory");
    expect(m.content).toBe("");
    expect(m.name).toBe("Chat history");
  });

  test("REFUSES a slot that is already placed (the whole invariant)", () => {
    const once = addMarker(base(), "chatHistory");
    const twice = addMarker(once, "chatHistory");
    expect(twice.prompts).toHaveLength(1);
    expect(twice).toBe(once); // unchanged body, not a clone
  });

  test("different slots coexist", () => {
    let b = addMarker(base(), "chatHistory");
    b = addMarker(b, "charDescription");
    b = addMarker(b, "worldInfoBefore");
    expect(b.prompts.map((p) => p.markerSlot)).toEqual(["chatHistory", "charDescription", "worldInfoBefore"]);
  });

  test("an unknown slot still round-trips rather than being dropped", () => {
    const b = addMarker(base(), "someFutureSlot");
    expect(b.prompts[0]!.markerSlot).toBe("someFutureSlot");
    expect(b.prompts[0]!.name).toBe("someFutureSlot");
  });

  test("never mutates the input body", () => {
    const original = base();
    addMarker(original, "scenario");
    expect(original.prompts).toHaveLength(0);
  });

  test("markers land alongside ordinary blocks", () => {
    const b = addMarker({ ...base(), prompts: [newBlock({ id: "plain" })] }, "chatHistory");
    expect(b.prompts.map((p) => p.marker)).toEqual([false, true]);
  });
});

describe("placedMarkerSlots", () => {
  test("empty for a preset with no markers", () => {
    expect(placedMarkerSlots({ ...base(), prompts: [newBlock()] }).size).toBe(0);
  });

  test("reports exactly the placed slots", () => {
    let b = addMarker(base(), "chatHistory");
    b = addMarker(b, "scenario");
    const placed = placedMarkerSlots(b);
    expect([...placed].sort()).toEqual(["chatHistory", "scenario"]);
  });

  test("ignores a marker block with no slot (imported junk must not crash the menu)", () => {
    const b: PresetBody = { ...base(), prompts: [newBlock({ marker: true })] };
    expect(placedMarkerSlots(b).size).toBe(0);
  });
});

describe("markerSlotName", () => {
  test("sentence-cases core's own labels, inventing no new copy", () => {
    expect(markerSlotName("chatHistory")).toBe("Chat history");
    expect(markerSlotName("charDescription")).toBe("Character description");
    expect(markerSlotName("worldInfoBefore")).toBe("World info (before)");
    expect(markerSlotName("dialogueExamples")).toBe("Example messages");
  });

  test("falls back to the raw slot id when core has no label for it", () => {
    expect(markerSlotName("nonsenseSlot")).toBe("nonsenseSlot");
  });
});
