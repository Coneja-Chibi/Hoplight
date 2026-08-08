/** Dispatch ties the model's tool calls to our tools: spec derivation, and fail-closed running. */
import { expect, test } from "bun:test";
import type { EntitySummary, KitBridge } from "../bridge";
import type { ToolContext } from "../tools/tool";
import docsQuery from "../tools/docs-query";
import { discoverTools } from "../tools/discover";
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
  expect(specs.map((spec) => spec.name).sort()).toEqual([
    "studio_list",
    "studio_read",
    "studio_search",
  ]);
  const listSpec = specs.find((spec) => spec.name === "studio_list");
  expect(listSpec?.description.length ?? 0).toBeGreaterThan(0);
  expect(listSpec?.schema).toHaveProperty("type", "object");
});

test("toolSpecs flattens discriminated-union inputs into a provider object schema", () => {
  const specs = toolSpecs([docsQuery]);
  const spec = specs.find((entry) => entry.name === "docs_query");
  expect(spec).toBeDefined();
  // OpenAI-compatible endpoints reject bare oneOf/anyOf roots ("schema must be a JSON Schema of
  // type object"), so a provider spec must always be a flat object schema.
  expect(spec?.schema).toHaveProperty("type", "object");
  expect(spec?.schema).not.toHaveProperty("oneOf");
  expect(spec?.schema).not.toHaveProperty("anyOf");
  const properties = (spec?.schema as { properties?: Record<string, unknown> }).properties;
  expect(properties?.action).toMatchObject({ type: "string" });
  // Discriminator consts merge into one enum so the model sees every action it can send.
  const actionEnum = (properties?.action as { enum?: string[] }).enum;
  expect(actionEnum).toEqual(expect.arrayContaining(["search", "browse", "outline", "read"]));
  expect((spec?.schema as { required?: string[] }).required).toContain("action");
});

test("merged properties are least-restrictive across union variants", () => {
  const specs = toolSpecs([docsQuery]);
  const spec = specs.find((entry) => entry.name === "docs_query");
  const properties = (spec?.schema as { properties?: Record<string, unknown> }).properties;
  // browse.limit is valid up to 25 while search.limit caps at 8; the flattened provider schema
  // must not advertise the narrower bound for the shared limit property, or a schema-guided
  // provider would reject or avoid valid browse calls before the Zod parse.
  expect((properties?.limit as { maximum?: number }).maximum).toBe(25);
  expect((properties?.limit as { minimum?: number }).minimum).toBe(1);
});

test("every drop-in tool advertises a provider schema with a root object type", async () => {
  // Structural guard: a tool whose Zod input serializes without a root type (unions and
  // discriminated unions) is rejected by OpenAI-compatible providers at the first turn. This is
  // what bit docs_query and result_query before providerSchema flattened them.
  const tools = await discoverTools();
  expect(tools.length).toBeGreaterThan(0);
  for (const spec of toolSpecs(tools)) {
    expect(spec.schema, `${spec.name} provider schema`).toHaveProperty("type", "object");
  }
});

test("dispatch runs a valid call", async () => {
  const result = await dispatch({ id: "1", name: "studio_list", args: {} });
  expect(result.summary).toBe("list all: 2");
  expect(result.output).toContain("character/nyx");
});

test("dispatch rejects an unknown tool, tolerantly", async () => {
  const result = await dispatch({ id: "2", name: "nope", args: {} });
  expect(result.summary).toContain("unknown tool");
});

test("dispatch fails closed on bad args", async () => {
  const result = await dispatch({ id: "3", name: "studio_list", args: { kind: "banana" } });
  expect(result.summary).toContain("bad args");
});

test("dispatch and provider specs reject duplicate tool names", () => {
  expect(() => makeDispatch([list, { ...read, name: list.name }], ctx))
    .toThrow('duplicate tool name "studio_list"');
  expect(() => toolSpecs([list, { ...search, name: list.name }]))
    .toThrow('duplicate tool name "studio_list"');
});

test("a drop-in cannot collide with a lifecycle tool name", () => {
  const dropIn = { ...list, name: "change_apply" };
  const lifecycle = { ...read, name: "change_apply" };
  expect(() => makeDispatch([dropIn, lifecycle], ctx))
    .toThrow('duplicate tool name "change_apply"');
});
