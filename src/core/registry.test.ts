import { test, expect } from "bun:test";
import * as registry from "./registry";
import { loadFormats } from "./loader";
import { CANONICAL_SCHEMA_VERSION } from "./canonical";
import type { CanonicalCharacter } from "../entities/character/schema";

const sample: CanonicalCharacter = {
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "character",
  id: "test-alice",
  body: {
    identity: { name: "Alice", tagline: "in wonderland" },
    persona: { personality: "curious" },
    prompts: {},
    greetings: { firstMessage: "Hello there." },
    examples: {},
    media: {},
    attribution: { creator: "chi" },
    discovery: { tags: ["fantasy"] },
  },
};

test("folders-as-schema: adapters auto-load from src/formats", async () => {
  await loadFormats();
  // the _template folder must be skipped; vaud-json must be found
  expect(registry.get("template")).toBeUndefined();
  expect(registry.get("vaud-json")).toBeDefined();
});

/** Narrow a registered adapter to its character member (the registry returns the kind union). */
function characterAdapter(id: string) {
  const a = registry.get(id);
  if (a?.kind !== "character") throw new Error(`registry.test: ${id} is not a character adapter`);
  return a;
}

test("a dropped-in adapter round-trips a character losslessly", async () => {
  await loadFormats();
  const vj = characterAdapter("vaud-json");
  const out = vj.fromCanonical(sample);
  const back = vj.toCanonical({ text: out.text ?? "" });
  expect(back).toEqual(sample);
});

test("detect picks the native format for vaud json", async () => {
  await loadFormats();
  const out = characterAdapter("vaud-json").fromCanonical(sample);
  const winner = registry.detect({ text: out.text ?? "" });
  expect(winner?.id).toBe("vaud-json");
});
