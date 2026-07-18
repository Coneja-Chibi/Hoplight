/**
 * Press job-sheet core: platform grouping, run planning, filename minting, payloads, the tally.
 */
import { describe, expect, test } from "bun:test";
import type { FormatInfo, StudioEntitySummary } from "../../app-contract";
import {
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
      fmt({ id: "vaud-json", friendly: "Vaude", native: true }),
      fmt({ id: "novelai-lorebook", friendly: "NovelAI", kind: "lorebook" }),
    ]);
    expect(platforms.map((p) => p.friendly)).toEqual(["NovelAI", "SillyTavern"]);
    const st = platforms.find((p) => p.friendly === "SillyTavern")!;
    expect(st.byKind.character?.id).toBe("sillytavern");
    expect(st.byKind.lorebook?.id).toBe("sillytavern-lorebook");
    expect(platforms.find((p) => p.friendly === "Vaude")).toBeUndefined();
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
