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

const bridgeWith = (
  presets: { id: string; name: string }[],
  others: Record<string, { id: string; name: string }[]> = {},
): KitBridge => ({
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list(kind?: string) {
    if (kind === "preset") return presets as EntitySummary[];
    return (others[kind ?? ""] ?? []) as EntitySummary[];
  },
  async read() { return null; },
  async save() { throw new Error("rail_open must not write"); },
  async delete() { return false; },
});

const ctx = (
  presets: { id: string; name: string }[],
  others?: Record<string, { id: string; name: string }[]>,
): ToolContext => ({ bridge: bridgeWith(presets, others) });

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

describe("which surface the words name", () => {
  const open = (surface?: string) => railOpen.execute(
    { action: "show" as const, preset: "paramnesia" },
    { ...ctx([{ id: "paramnesia", name: "Paramnesia" }]), ...(surface ? { surface } : {}) },
  );

  test("the terminal keeps the word every existing transcript uses", async () => {
    expect((await open()).output).toContain("the rail");
  });

  test("THE WINDOW NEVER CLAIMS A RAIL IT DOES NOT HAVE", async () => {
    /**
     * Seen on somebody's screen: the desktop window answered "H.T. Case Files - Milquetoast is open
     * on the rail" in an app with no rail column, and nothing had opened anywhere. A sentence about
     * a surface is only true where that surface is.
     */
    const said = (await open("the Workbench")).output;
    expect(said).toContain("open on the Workbench");
    expect(said).not.toContain("rail");
  });

  test("the structured show is the same either way: only the words are local", async () => {
    expect((await open()).show).toEqual({ kind: "preset", id: "paramnesia" });
    expect((await open("the Workbench")).show).toEqual({ kind: "preset", id: "paramnesia" });
  });
});

/**
 * ASKED FOR A DRAWING, which is what happens the moment somebody has one.
 *
 * The rail holds a preset's blocks in evaluation order; a drawing has no blocks. The old answer
 * listed every preset in the studio and said none matched - true, and easy to read as "that piece
 * cannot be opened at all", which is what it was read as.
 */
describe("a name that is a real piece of another kind", () => {
  const withDrawing = () =>
    ctx(
      [{ id: "paramnesia", name: "Paramnesia" }],
      { htmldoc: [{ id: "astrolabe-01", name: "Astrolabe 01" }] },
    );

  test("says which kind it is and where that kind opens, rather than listing presets", async () => {
    const result = await railOpen.execute(
      { action: "show" as const, preset: "astrolabe-01" },
      withDrawing(),
    );
    expect(result.summary).toContain("is a htmldoc, not a preset");
    expect(result.output).toContain("Astrolabe 01");
    expect(result.output).toContain("HTML View");
    // The way to CHANGE it, since that is what the request usually meant.
    expect(result.output).toContain("edit the wireframe");
    // And no preset roll-call, which is what made the old answer read as a dead end.
    expect(result.output).not.toContain("paramnesia");
  });

  test("nothing is opened: no structured show rides on a refusal", async () => {
    const result = await railOpen.execute(
      { action: "show" as const, preset: "astrolabe-01" },
      withDrawing(),
    );
    expect(result.show).toBeUndefined();
    expect(result.output).toContain("Nothing was opened");
  });

  test("a name that is nothing at all still gets the old honest answer", async () => {
    const result = await railOpen.execute(
      { action: "show" as const, preset: "not-a-thing" },
      withDrawing(),
    );
    expect(result.output).toContain("No preset matches");
  });
});
