/**
 * Putting a preset on the rail from the conversation.
 *
 * The structured `show` is the point: the shell must never open a view because a sentence claimed it
 * was open. So the tests check that the signal is present exactly when a single preset was resolved,
 * and absent every other time, including the times the tool still has something useful to say.
 */
import { describe, expect, test } from "bun:test";
import type { EntitySummary, KitBridge } from "../bridge";
import type { ToolContext } from "./tool";
import railOpen from "./rail-open";

const bridgeWith = (presets: { id: string; name: string }[]): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list(kind?: string) {
    return (kind === "preset" ? presets : []) as EntitySummary[];
  },
  async read() { return null; },
  async save() { throw new Error("rail_open must not write"); },
  async delete() { return false; },
});

const ctx = (presets: { id: string; name: string }[]): ToolContext =>
  ({ bridge: bridgeWith(presets) });

describe("rail_open", () => {
  test("a single match carries the structured show, not just prose", async () => {
    const result = await railOpen.execute(
      { action: "show" as const, preset: "paramnesia" },
      ctx([{ id: "paramnesia-vi-rc", name: "Paramnesia VI RC" }]),
    );
    expect(result.show).toEqual({ kind: "preset", id: "paramnesia-vi-rc" });
    expect(result.summary).toContain("paramnesia-vi-rc");
  });

  test("it matches on id or on display name", async () => {
    const pieces = [{ id: "para-vi", name: "Deep Water" }];
    for (const query of ["para", "PARA-VI", "deep", "Water"]) {
      const result = await railOpen.execute({ action: "show" as const, preset: query }, ctx(pieces));
      expect(result.show?.id).toBe("para-vi");
    }
  });

  test("several matches carry NO show, and tell the model not to pick", async () => {
    // Opening the wrong preset and rearranging it is the failure this surface exists to prevent.
    const result = await railOpen.execute(
      { action: "show" as const, preset: "para" },
      ctx([{ id: "para-v5", name: "Para V5" }, { id: "para-v6", name: "Para V6" }]),
    );
    expect(result.show).toBeUndefined();
    expect(result.output).toContain("do not pick");
    expect(result.output).toContain("para-v5");
  });

  test("no match carries no show and names what exists", async () => {
    const result = await railOpen.execute({ action: "show" as const, preset: "zzz" }, ctx([{ id: "only", name: "Only" }]));
    expect(result.show).toBeUndefined();
    expect(result.output).toContain("only");
  });

  test("an empty studio says so rather than that nothing matched", async () => {
    const result = await railOpen.execute({ action: "show" as const, preset: "any" }, ctx([]));
    expect(result.show).toBeUndefined();
    expect(result.output).toContain("no presets");
  });

  test("it is read-only, so opening a view never needs a confirmation", async () => {
    // The rail it opens is still a write surface; every edit made there still meets the gate.
    expect(railOpen.effect).toBe("read");
    expect(railOpen.exposure).toBe("direct");
  });

  test("an empty preset name is refused fail-closed", () => {
    expect(railOpen.input.safeParse({ action: "show" as const, preset: "" }).success).toBe(false);
    expect(railOpen.input.safeParse({}).success).toBe(false);
  });
});
