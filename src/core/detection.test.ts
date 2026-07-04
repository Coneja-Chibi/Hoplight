/**
 * Cross-adapter detection firewall. With every format registered, each format's own sample must
 * route to exactly the right adapter, no collisions. This is the property that keeps the system
 * modular: adding a new format folder must not silently steal detection from an existing one.
 */
import { test, expect, beforeAll } from "bun:test";
import { registry, loadFormats, CANONICAL_SCHEMA_VERSION } from "./index";
import { zipSync, strToU8 } from "fflate";

beforeAll(async () => {
  await loadFormats();
});

const asText = (o: unknown) => ({ text: JSON.stringify(o) });
const asCharx = (card: unknown) => ({ bytes: zipSync({ "card.json": strToU8(JSON.stringify(card)) }) });

interface Case {
  label: string;
  expected: string;
  input: { text?: string; bytes?: Uint8Array };
}

const CASES: Case[] = [
  {
    label: "plain CCv2 card -> sillytavern",
    expected: "sillytavern",
    input: asText({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "A", first_mes: "hi" } }),
  },
  {
    label: "CCv3 card WITH extensions.rolecall -> rolecall (outranks the generic ST reader)",
    expected: "rolecall",
    input: asText({ spec: "chara_card_v3", data: { name: "A", extensions: { rolecall: { id: "1" } } } }),
  },
  {
    label: ".charx zip -> risu",
    expected: "risu",
    input: asCharx({ spec: "chara_card_v3", data: { name: "A", extensions: {} } }),
  },
  {
    label: "native Agnai card -> agnai",
    expected: "agnai",
    input: asText({ kind: "character", persona: { kind: "text", attributes: { text: [""] } }, greeting: "hi" }),
  },
  {
    label: "legacy Backyard flat card -> backyard (does NOT collide with agnai's persona clause)",
    expected: "backyard",
    input: asText({ aiName: "A", aiPersona: "x" }),
  },
  {
    label: "our own canonical json -> vaud-json",
    expected: "vaud-json",
    input: asText({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: "a",
      body: {
        identity: { name: "A" },
        persona: {},
        prompts: {},
        greetings: {},
        examples: {},
        media: {},
        attribution: {},
        discovery: {},
      },
    }),
  },
];

for (const c of CASES) {
  test(`routes: ${c.label}`, () => {
    expect(registry.detect(c.input)?.id).toBe(c.expected);
  });
}

test("every registered adapter declares at least one output extension (drop-in contract)", () => {
  const adapters = registry.all();
  expect(adapters.length).toBeGreaterThanOrEqual(6);
  for (const a of adapters) expect(a.outputExtensions.length).toBeGreaterThan(0);
});
