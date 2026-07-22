/** Coverage for the read tools: fail-closed arg parsing, happy-path output, and discovery. */
import { describe, expect, test } from "bun:test";
import type { EntitySummary, KitBridge, KitEntity } from "../bridge";
import type { ToolContext } from "./tool";
import { discoverTools } from "./discover";
import list from "./list";
import read from "./read";
import search from "./search";

const SUMMARIES: EntitySummary[] = [
  { id: "nyx", kind: "character", name: "Nyx", sourceFormat: "sillytavern" },
  { id: "cherry", kind: "character", name: "Cherry" },
  { id: "world", kind: "lorebook", name: "World Bible" },
];

const NYX = {
  id: "nyx",
  kind: "character",
  body: { identity: { name: "Nyx" }, description: "a test character" },
} as unknown as KitEntity;

const fakeBridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() {
    return [];
  },
  async list(kind?: string) {
    return kind ? SUMMARIES.filter((summary) => summary.kind === kind) : SUMMARIES;
  },
  async read(kind: string, id: string) {
    return kind === "character" && id === "nyx" ? NYX : null;
  },
};

const ctx: ToolContext = { bridge: fakeBridge };

describe("list", () => {
  test("lists everything, formatted", async () => {
    const result = await list.execute({}, ctx);
    expect(result.summary).toBe("list all: 3");
    expect(result.output).toContain("character/nyx  Nyx  (sillytavern)");
    expect(result.output).toContain("lorebook/world  World Bible");
  });

  test("narrows to one deck", async () => {
    const result = await list.execute({ kind: "character" }, ctx);
    expect(result.summary).toBe("list character: 2");
  });

  test("empty deck reports zero, not an error", async () => {
    const result = await list.execute({ kind: "persona" }, ctx);
    expect(result.summary).toBe("list persona: 0");
  });

  test("rejects an unknown kind fail-closed", () => {
    expect(list.input.safeParse({ kind: "banana" }).success).toBe(false);
  });
});

describe("read", () => {
  test("opens a known piece", async () => {
    const result = await read.execute({ kind: "character", id: "nyx" }, ctx);
    expect(result.summary).toBe("read character/nyx");
    expect(result.output).toContain("Nyx  (character/nyx)");
    expect(result.output).toContain("a test character");
  });

  test("missing piece reports not found, does not throw", async () => {
    const result = await read.execute({ kind: "character", id: "ghost" }, ctx);
    expect(result.summary).toBe("read character/ghost: not found");
  });

  test("rejects missing id fail-closed", () => {
    expect(read.input.safeParse({ kind: "character" }).success).toBe(false);
    expect(read.input.safeParse({ kind: "character", id: "" }).success).toBe(false);
  });
});

describe("search", () => {
  test("finds by name, case-insensitive", async () => {
    const result = await search.execute({ query: "NYX" }, ctx);
    expect(result.summary).toBe('search "NYX": 1');
    expect(result.output).toContain("character/nyx");
  });

  test("no match reports zero", async () => {
    const result = await search.execute({ query: "zzz" }, ctx);
    expect(result.summary).toBe('search "zzz": 0');
  });

  test("rejects an empty query fail-closed", () => {
    expect(search.input.safeParse({}).success).toBe(false);
    expect(search.input.safeParse({ query: "" }).success).toBe(false);
  });
});

describe("discovery", () => {
  test("finds the drop-in tools and skips infra", async () => {
    const names = (await discoverTools()).map((tool) => tool.name).sort();
    expect(names).toEqual(["list", "read", "search"]);
  });
});
