/**
 * Variant override helpers: blank "" / [] survive; explicit inherit removes the key.
 */
import { expect, test } from "bun:test";
import type { CharacterBody } from "../../../entities/character/schema";
import { applyVariant } from "../../../entities/character/variant";
import { hasOverridePath, inheritOverridePath, readPath, writeOverridePath, writePath } from "./editor-core";
import {
  addVariant,
  inheritVariantField,
  setVariantField,
  variantHasOverride,
  variantsOf,
} from "./variants";

const base: CharacterBody = {
  identity: { name: "Mosis", description: "base desc" },
  persona: { personality: "wry", scenario: "inn" },
  prompts: {},
  greetings: { firstMessage: "hi", alternateGreetings: [{ text: "alt" }] },
  examples: {},
  media: {},
  attribution: {},
  discovery: { tags: ["a"] },
};

test("writeOverridePath keeps blank text and empty arrays", () => {
  const over = writeOverridePath({}, "identity.description", "");
  expect(over).toEqual({ identity: { description: "" } });
  const overArr = writeOverridePath({}, "discovery.tags", []);
  expect(overArr).toEqual({ discovery: { tags: [] } });
  // base writePath still deletes empties
  expect(readPath(writePath({}, "identity.description", ""), "identity.description")).toBeUndefined();
});

test("inheritOverridePath deletes only the leaf key", () => {
  const over = writeOverridePath(
    writeOverridePath({}, "identity.description", "x"),
    "identity.tagline",
    "y",
  );
  const next = inheritOverridePath(over, "identity.description");
  expect(hasOverridePath(next, "identity.description")).toBe(false);
  expect(hasOverridePath(next, "identity.tagline")).toBe(true);
  expect(readPath(next, "identity.tagline")).toBe("y");
});

test("setVariantField stores blank text override; applyVariant clears the base field", () => {
  let body = addVariant(base, "v1", "Dark");
  body = setVariantField(body, "v1", "identity.description", "");
  const v = variantsOf(body).find((x) => x.id === "v1")!;
  expect(v.overrides).toEqual({ identity: { description: "" } });
  expect(variantHasOverride(body, "v1", "identity.description")).toBe(true);
  const merged = applyVariant(body, v);
  expect(merged.identity.description).toBe("");
  expect(merged.identity.name).toBe("Mosis"); // inherited
});

test("setVariantField stores empty-array override", () => {
  let body = addVariant(base, "v1", "Dark");
  body = setVariantField(body, "v1", "discovery.tags", []);
  body = setVariantField(body, "v1", "greetings.alternateGreetings", []);
  const v = variantsOf(body).find((x) => x.id === "v1")!;
  expect(readPath(v.overrides, "discovery.tags")).toEqual([]);
  expect(readPath(v.overrides, "greetings.alternateGreetings")).toEqual([]);
  const merged = applyVariant(body, v);
  expect(merged.discovery.tags).toEqual([]);
  expect(merged.greetings.alternateGreetings).toEqual([]);
});

test("inheritVariantField removes the override and resumes base inheritance", () => {
  let body = addVariant(base, "v1", "Dark");
  body = setVariantField(body, "v1", "persona.personality", "cruel");
  body = setVariantField(body, "v1", "identity.description", "");
  body = inheritVariantField(body, "v1", "identity.description");
  expect(variantHasOverride(body, "v1", "identity.description")).toBe(false);
  expect(variantHasOverride(body, "v1", "persona.personality")).toBe(true);
  const v = variantsOf(body).find((x) => x.id === "v1")!;
  const merged = applyVariant(body, v);
  expect(merged.identity.description).toBe("base desc");
  expect(merged.persona.personality).toBe("cruel");
});
