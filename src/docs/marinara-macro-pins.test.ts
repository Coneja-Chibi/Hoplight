/**
 * Regression: Marinara pinned macro catalog and local reference stay complete.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARINARA_BUILTIN_MACROS,
  MARINARA_CONDITIONAL_OPERATORS,
  MARINARA_ENGINE_COMMIT,
  MARINARA_MACRO_FORMS,
} from "./marinara-macro-pins";

const root = join(import.meta.dir, "../..");
const catalog = readFileSync(
  join(root, "docs/reference/platforms/marinara/macro-reference.md"),
  "utf8",
);
const prompts = readFileSync(
  join(root, "docs/reference/platforms/marinara/prompts-and-macros.md"),
  "utf8",
);

test("Marinara pin commit is recorded on the catalog page", () => {
  expect(catalog).toContain(MARINARA_ENGINE_COMMIT);
});

test("every pinned bare built-in macro name appears in the catalog", () => {
  for (const name of MARINARA_BUILTIN_MACROS) {
    expect(catalog.includes(`{{${name}}}`) || catalog.includes(`\`${name}\``)).toBe(true);
  }
});

test("documented argument forms and conditional operators are present", () => {
  for (const form of MARINARA_MACRO_FORMS) {
    expect(catalog.includes(form) || prompts.includes(form)).toBe(true);
  }
  for (const op of MARINARA_CONDITIONAL_OPERATORS) {
    expect(prompts.includes(op) || catalog.includes(op)).toBe(true);
  }
});

test("catalog does not use etc. as a substitute for persona field names", () => {
  expect(catalog).toContain("{{personaDescription}}");
  expect(catalog).toContain("{{personaPersonality}}");
  expect(catalog).toContain("{{personaBackstory}}");
  expect(catalog).toContain("{{personaAppearance}}");
  expect(catalog).toContain("{{personaScenario}}");
  expect(catalog.toLowerCase()).not.toMatch(/personaDescription etc/i);
});

test("pinned macro inventory has a stable minimum size", () => {
  expect(MARINARA_BUILTIN_MACROS.length).toBeGreaterThanOrEqual(50);
  expect(new Set(MARINARA_BUILTIN_MACROS).size).toBe(MARINARA_BUILTIN_MACROS.length);
});

test("catalog documents setvar random prepass and agent empty-before-output lifecycle", () => {
  expect(catalog.toLowerCase()).toMatch(/setvar/);
  expect(catalog.toLowerCase()).toMatch(/every option before the pick|before the pick/);
  expect(catalog.toLowerCase()).toMatch(/agent::type|agent text cannot inject/);
  expect(catalog.toLowerCase()).toMatch(/left-to-right|left to right/);
  expect(catalog.toLowerCase()).toMatch(/no api key|no api/);
});
