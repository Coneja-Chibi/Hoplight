/**
 * Press job-sheet core: platform grouping, run planning, filename minting, payloads, the tally.
 */
import { describe, expect, test } from "bun:test";
import type { FormatInfo, StudioEntitySummary } from "../../app-contract";
import {
  flavorChoosable,
  flavorExtension,
  foldSummary,
  groupPlatforms,
  mintFilename,
  payloadBytes,
  planRun,
  type RunRow,
} from "./press-core";

const fmt = (over: Partial<FormatInfo>): FormatInfo => ({
  id: "x",
  label: "X",
  kind: "character",
  outputExtensions: ["json"],
  friendly: "X",
  native: false,
  generic: false,
  ...over,
});

const piece = (over: Partial<StudioEntitySummary>): StudioEntitySummary => ({
  id: "p1",
  kind: "character",
  name: "Adrian",
  ...over,
});

describe("groupPlatforms", () => {
  test("groups adapters under one friendly platform per kind; native never becomes a target", () => {
    const platforms = groupPlatforms([
      fmt({ id: "sillytavern", friendly: "SillyTavern", kind: "character" }),
      fmt({ id: "sillytavern-lorebook", friendly: "SillyTavern", kind: "lorebook" }),
      fmt({ id: "vaud-json", friendly: "Hoplight", native: true }),
      fmt({ id: "novelai-lorebook", friendly: "NovelAI", kind: "lorebook" }),
    ]);
    expect(platforms.map((p) => p.friendly)).toEqual(["NovelAI", "SillyTavern"]);
    const st = platforms.find((p) => p.friendly === "SillyTavern")!;
    expect(st.byKind.character?.id).toBe("sillytavern");
    expect(st.byKind.lorebook?.id).toBe("sillytavern-lorebook");
    expect(platforms.find((p) => p.friendly === "Hoplight")).toBeUndefined();
  });
});

describe("planRun", () => {
  test("kinds the platform cannot print become skip rows up front, named honestly", () => {
    const novelai = groupPlatforms([fmt({ id: "novelai-lorebook", friendly: "NovelAI", kind: "lorebook" })])[0]!;
    const rows = planRun(
      [piece({ kind: "character", name: "Adrian" }), piece({ id: "b1", kind: "lorebook", name: "Cargo" })],
      novelai,
    );
    expect(rows[0]).toMatchObject({ status: "skip", note: "NovelAI has no character format" });
    expect(rows[1]).toMatchObject({ status: "wait", targetId: "novelai-lorebook" });
  });
});

describe("mintFilename", () => {
  test("sanitizes and dedupes inside one run", () => {
    const taken = new Set<string>();
    expect(mintFilename("Adrian", "json", taken)).toBe("adrian.json".replace("adrian", "Adrian"));
    expect(mintFilename("Adrian", "json", taken)).toBe("Adrian-2.json");
    expect(mintFilename("a/b:c", ".charx", taken)).toBe("a_b_c.charx");
    expect(mintFilename("..\\deck\u0000name", "json", taken)).toBe(".._deck_name.json");
  });
});

describe("payloadBytes", () => {
  test("text encodes, b64 decodes, empty is null", () => {
    expect(new TextDecoder().decode(payloadBytes({ text: "hi" })!)).toBe("hi");
    expect([...payloadBytes({ bytesB64: btoa("\x01\x02") })!]).toEqual([1, 2]);
    expect(payloadBytes({})).toBeNull();
  });
});

describe("foldSummary", () => {
  const row = (status: RunRow["status"]): RunRow => ({ id: "x", kind: "character", name: "X", status });
  test("names only the states that occurred", () => {
    expect(foldSummary([])).toBe("nothing picked yet");
    expect(foldSummary([row("ok"), row("warn"), row("fail"), row("skip")])).toBe(
      "2 printed · 1 with notes · 1 failed · 1 skipped",
    );
    expect(foldSummary([row("wait"), row("wait")])).toBe("2 waiting");
  });
});

describe("file flavor", () => {
  test("only text wire formats offer flavors; the flavor swaps the extension", () => {
    expect(flavorChoosable("json")).toBe(true);
    expect(flavorChoosable(".charx")).toBe(false);
    expect(flavorChoosable("byaf")).toBe(false);
    expect(flavorExtension("json", "normal")).toBe("json");
    expect(flavorExtension("json", "md")).toBe("md");
    expect(flavorExtension("json", "txt")).toBe("txt");
  });
});

describe("extension-map hosts print characters as the card itself", () => {
  const roster = [
    fmt({ id: "marinara-regex", friendly: "Marinara", kind: "regex" }),
    fmt({ id: "sillytavern", friendly: "SillyTavern", kind: "character" }),
    fmt({ id: "novelai-lorebook", friendly: "NovelAI", kind: "lorebook" }),
  ];

  test("Marinara gains the CCv3 card as its character format, marked as such", () => {
    const mari = groupPlatforms(roster).find((p) => p.friendly === "Marinara")!;
    expect(mari.byKind.character?.id).toBe("sillytavern");
    expect(mari.borrowed?.character).toContain("CCv3");
  });

  test("the planned row says what it prints as; true no-format hosts still skip", () => {
    const platforms = groupPlatforms(roster);
    const mari = platforms.find((p) => p.friendly === "Marinara")!;
    const nai = platforms.find((p) => p.friendly === "NovelAI")!;
    const char = piece({ kind: "character", name: "Adrian" });
    expect(planRun([char], mari)[0]).toMatchObject({
      status: "wait",
      targetId: "sillytavern",
      info: "prints as a CCv3 card, its native character file",
    });
    expect(planRun([char], nai)[0]).toMatchObject({ status: "skip" });
  });
});
