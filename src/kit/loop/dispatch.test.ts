/** Dispatch ties the model's tool calls to our tools: spec derivation, and fail-closed running. */
import { expect, test } from "bun:test";
import type { EntitySummary, KitBridge } from "../bridge";
import type { ToolContext } from "../tools/tool";
import list from "../tools/list";
import read from "../tools/read";
import search from "../tools/search";
import { makeDispatch, toolSpecs } from "./dispatch";

const SUMMARIES: EntitySummary[] = [
  { id: "nyx", kind: "character", name: "Nyx" },
  { id: "world", kind: "lorebook", name: "World Bible" },
];

const fakeBridge: KitBridge = {
  studioDir: "/fake",
  async deckCounts() {
    return [];
  },
  async list(kind?: string) {
    return kind ? SUMMARIES.filter((summary) => summary.kind === kind) : SUMMARIES;
  },
  async read() {
    return null;
  },
  async save() {
    throw new Error("no writes in this test");
  },
  async delete() {
    return false;
  },
};

const tools = [list, read, search];
const ctx: ToolContext = { bridge: fakeBridge };
const dispatch = makeDispatch(tools, ctx);

test("toolSpecs advertises each tool with a JSON schema", () => {
  const specs = toolSpecs(tools);
  expect(specs.map((spec) => spec.name).sort()).toEqual(["list", "read", "search"]);
  const listSpec = specs.find((spec) => spec.name === "list");
  expect(listSpec?.description.length ?? 0).toBeGreaterThan(0);
  expect(listSpec?.schema).toHaveProperty("type", "object");
});

test("dispatch runs a valid call", async () => {
  const result = await dispatch({ id: "1", name: "list", args: {} });
  expect(result.summary).toBe("list all: 2");
  expect(result.output).toContain("character/nyx");
});

test("dispatch rejects an unknown tool, tolerantly", async () => {
  const result = await dispatch({ id: "2", name: "nope", args: {} });
  expect(result.summary).toContain("unknown tool");
});

test("dispatch fails closed on bad args", async () => {
  const result = await dispatch({ id: "3", name: "list", args: { kind: "banana" } });
  expect(result.summary).toContain("bad args");
});
