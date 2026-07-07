import { expect, test } from "bun:test";
import { applyVariant } from "./variant";
import type { CharacterBody } from "./schema";

const base: CharacterBody = {
  identity: { name: "Mosis", tagline: "base tag", description: "base desc" },
  persona: { personality: "base pers", scenario: "base scen" },
  prompts: { systemPrompt: "base sys" },
  greetings: { firstMessage: "base hi", alternateGreetings: [{ text: "alt base" }] },
  examples: { exampleMessages: "base ex" },
  media: {},
  attribution: {},
  discovery: {},
  presentation: { signatureColor: "#111111" }, // hardcode-ok: test fixture value, not chrome
};

test("mirror overlays only the non-empty variant fields; unset ones inherit from base", () => {
  const out = applyVariant(base, { id: "v1", name: "Dark Mosis", personality: "cruel" });
  expect(out.identity.name).toBe("Dark Mosis"); // overridden
  expect(out.identity.tagline).toBe("base tag"); // inherited
  expect(out.persona.personality).toBe("cruel"); // overridden
  expect(out.persona.scenario).toBe("base scen"); // inherited
  expect(out.prompts.systemPrompt).toBe("base sys"); // inherited
});

test("mirror ignores empty-string overrides (keeps base)", () => {
  const out = applyVariant(base, { id: "v1", name: "", description: "" });
  expect(out.identity.name).toBe("Mosis");
  expect(out.identity.description).toBe("base desc");
});

test("full override replaces the base; name falls through when unset, cleared fields blank", () => {
  const out = applyVariant(base, { id: "v2", mirrorBase: false, personality: "new pers" });
  expect(out.identity.name).toBe("Mosis"); // fell through (variant left name unset)
  expect(out.identity.tagline).toBe(""); // cleared
  expect(out.identity.description).toBe(""); // cleared
  expect(out.persona.personality).toBe("new pers"); // set
  expect(out.persona.scenario).toBe("base scen"); // persona/scenario fall through to base (RC behavior)
  expect(out.prompts.systemPrompt).toBe(""); // cleared
});

test("alternateGreetings: mirror keeps base when omitted, replaces when provided", () => {
  expect(applyVariant(base, { id: "v1", name: "X" }).greetings.alternateGreetings).toEqual([{ text: "alt base" }]);
  expect(applyVariant(base, { id: "v1", alternateGreetings: [{ text: "alt new" }] }).greetings.alternateGreetings).toEqual([
    { text: "alt new" },
  ]);
});

test("applyVariant does not mutate the base", () => {
  const snapshot = JSON.stringify(base);
  applyVariant(base, { id: "v1", mirrorBase: false, name: "X", scenario: "y" });
  expect(JSON.stringify(base)).toBe(snapshot);
});
