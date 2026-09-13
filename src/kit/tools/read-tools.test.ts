/** Coverage for the read tools: fail-closed arg parsing, happy-path output, and discovery. */
import { describe, expect, test } from "bun:test";
import type { EntitySummary, KitBridge, KitEntity } from "../bridge";
import type { ToolContext } from "./tool";
import { discoverTools } from "./discover";
import { createResultStore } from "../results/store";
import list from "./list";
import read from "./read";
import resultQuery from "./result-query";
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

const LARGE = {
  id: "large",
  kind: "character",
  body: { identity: { name: "Large" }, description: "x".repeat(9_000) },
} as unknown as KitEntity;

/**
 * Genuinely oversized, which is a moving target and has to be stated against the current ceiling.
 *
 * This was 70,000 chars, chosen when a piece spilled above 64,000. That line sat UNDER the size of
 * ordinary work in a real studio - two presets somebody was editing measured 76KB and 89KB - so the
 * common case paged eight times to read one file. The threshold moved to 120,000; the fixture moves
 * with it, because the behaviour under test is "a piece too big to hand over whole still pages
 * safely", not "70,000 is a lot".
 */
const OVERSIZED = {
  id: "oversized",
  kind: "character",
  body: { identity: { name: "Oversized" }, description: "x".repeat(200_000) },
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
    if (kind !== "character") return null;
    if (id === "nyx") return NYX;
    if (id === "large") return LARGE;
    if (id === "oversized") return OVERSIZED;
    return null;
  },
  async save() {
    throw new Error("no writes in this test");
  },
  async delete() {
    return false;
  },
};

const results = createResultStore();
const ctx: ToolContext = { bridge: fakeBridge, results };

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
    const output = JSON.parse(result.output) as {
      path: string;
      content: string;
      nextOffset: number | null;
    };
    expect(output.path).toBe("");
    expect(output.content).toContain("a test character");
    expect(output.nextOffset).toBeNull();
  });

  test("missing piece reports not found, does not throw", async () => {
    const result = await read.execute({ kind: "character", id: "ghost" }, ctx);
    expect(result.summary).toBe("read character/ghost: not found");
  });

  test("rejects missing id fail-closed", () => {
    expect(read.input.safeParse({ kind: "character" }).success).toBe(false);
    expect(read.input.safeParse({ kind: "character", id: "" }).success).toBe(false);
  });

  test("A PIECE THE SIZE OF REAL WORK ARRIVES IN ONE CALL", async () => {
    /**
     * The regression this threshold exists to prevent. At 64,000 an 89KB preset - small for the
     * studio it came from - cost eight round trips, and the agent spent its per-turn tool budget
     * turning pages instead of working. Asserted at a size taken from a real file, not a round
     * number, so a future tightening has to argue with the actual case.
     */
    const REAL = {
      id: "real-preset",
      kind: "character",
      body: { identity: { name: "Real" }, description: "x".repeat(88_945) },
    } as unknown as KitEntity;
    const bridge: KitBridge = { ...fakeBridge, async read() { return REAL; } };
    const result = await read.execute({ kind: "character", id: "real-preset" }, { bridge, results });
    const output = JSON.parse(result.output) as { spilled: boolean; nextOffset: number | null };
    expect(output.spilled).toBe(false);
    expect(output.nextOffset).toBeNull();
  });

  test("returns a normal large card in one complete default read", async () => {
    const result = await read.execute({ kind: "character", id: "large" }, ctx);
    const output = JSON.parse(result.output) as {
      spilled: boolean;
      content: string;
      totalChars: number;
      nextOffset: number | null;
    };

    expect(output.spilled).toBe(false);
    expect(output.content.length).toBe(output.totalChars);
    expect(output.totalChars).toBeGreaterThan(9_000);
    expect(output.nextOffset).toBeNull();
  });

  test("spills only a genuinely oversized default read without losing continuation", async () => {
    const result = await read.execute({ kind: "character", id: "oversized" }, ctx);
    const output = JSON.parse(result.output) as {
      spilled: boolean;
      handle: string;
      peek: string;
      totalChars: number;
    };

    expect(output.spilled).toBe(true);
    expect(output.peek.length).toBe(4_096);
    expect(output.totalChars).toBeGreaterThan(200_000);
    const tail = await resultQuery.execute({
      action: "read",
      handle: output.handle,
      offset: 199_500,
      limit: 2_000,
    }, ctx);
    expect(JSON.parse(tail.output).content).toContain("xxxxx");
  });

  test("supports structural outlines, JSON-pointer paths, and direct offsets", async () => {
    const outline = await read.execute({
      kind: "character",
      id: "large",
      action: "outline",
      path: "/body",
    }, ctx);
    const outlined = JSON.parse(outline.output) as {
      entries: Array<{ path: string; type: string }>;
    };
    expect(outlined.entries).toContainEqual(expect.objectContaining({
      path: "/body/description",
      type: "string",
    }));

    const slice = await read.execute({
      kind: "character",
      id: "large",
      action: "read",
      path: "/body/description",
      offset: 4_000,
      limit: 500,
    }, ctx);
    const sliced = JSON.parse(slice.output) as {
      content: string;
      offset: number;
      nextOffset: number | null;
    };
    expect(sliced.content).toHaveLength(500);
    expect(sliced.offset).toBe(4_000);
    expect(sliced.nextOffset).toBe(4_500);
  });

  test("rejects malformed or missing JSON-pointer paths without guessing", async () => {
    expect(read.input.safeParse({
      kind: "character",
      id: "nyx",
      path: "body.description",
    }).success).toBe(false);
    const result = await read.execute({
      kind: "character",
      id: "nyx",
      path: "/body/missing",
    }, ctx);
    expect(result.summary).toContain("path not found");
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
    expect(names).toEqual([
      "ask_choice",
      "block_lookup",
      "docs_query",
      "folder_import",
      "folder_search",
      "html_will_draw",
      "macro_lookup",
      "preset_verify",
      "rail_open",
      "regex_from_drawing",
      "regex_lab",
      "result_query",
      "studio_art",
      "studio_character_create",
      "studio_collections",
      "studio_delete",
      "studio_duplicate",
      "studio_export",
      "studio_graveyard",
      "studio_graveyard_bury",
      "studio_htmldoc_create",
      "studio_list",
      "studio_lorebook_create",
      "studio_pack_create",
      "studio_persona_create",
      "studio_preset_create",
      "studio_quickreply_create",
      "studio_read",
      "studio_regex_create",
      "studio_search",
      "studio_transfer",
    ]);
  });
});
