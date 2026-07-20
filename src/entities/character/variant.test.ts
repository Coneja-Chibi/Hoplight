/** Regression coverage for the variant.test behavior owned beside this file. */
import { expect, test } from "bun:test";
import { applyVariant } from "./variant";
import type { CharacterBody } from "./schema";

const base: CharacterBody = {
  identity: { name: "Mosis", tagline: "base tag", description: "base desc" },
  persona: {
    personality: "base pers",
    scenario: "base scen",
    appearance: "base look",
    voice: { provider: "elevenlabs", voiceId: "abc" },
  },
  prompts: { systemPrompt: "base sys", postHistoryInstructions: "base phi" },
  greetings: { firstMessage: "base hi", alternateGreetings: [{ text: "alt base" }] },
  examples: { exampleMessages: "base ex" },
  media: {},
  attribution: {},
  discovery: {},
  presentation: { signatureColor: "#111111" }, // hardcode-ok: test fixture value, not chrome
};

test("overrides any named field; unnamed fields inherit from base", () => {
  const out = applyVariant(base, { id: "v1", overrides: { identity: { name: "Dark Mosis" }, persona: { personality: "cruel" } } });
  expect(out.identity.name).toBe("Dark Mosis");
  expect(out.identity.tagline).toBe("base tag"); // inherited
  expect(out.persona.personality).toBe("cruel");
  expect(out.persona.scenario).toBe("base scen"); // inherited
});

test("can alter fields RC's fixed subset never had (appearance, post-history)", () => {
  const out = applyVariant(base, {
    id: "v1",
    overrides: { persona: { appearance: "scarred" }, prompts: { postHistoryInstructions: "new phi" } },
  });
  expect(out.persona.appearance).toBe("scarred");
  expect(out.prompts.postHistoryInstructions).toBe("new phi");
  expect(out.prompts.systemPrompt).toBe("base sys"); // inherited
});

test("nested objects deep-merge (voice.provider changes, voiceId kept)", () => {
  const out = applyVariant(base, { id: "v1", overrides: { persona: { voice: { provider: "openai" } } } });
  expect(out.persona.voice).toEqual({ provider: "openai", voiceId: "abc" });
});

test("arrays replace wholesale; a present empty string clears a field", () => {
  const out = applyVariant(base, {
    id: "v1",
    overrides: { greetings: { alternateGreetings: [{ text: "new" }] }, identity: { description: "" } },
  });
  expect(out.greetings.alternateGreetings).toEqual([{ text: "new" }]);
  expect(out.identity.description).toBe(""); // cleared: key present
});

test("full override (mirrorBase=false) replaces defined sections wholesale; omitted inherit; name falls through", () => {
  const out = applyVariant(base, {
    id: "v2",
    mirrorBase: false,
    overrides: { persona: { personality: "new pers" }, identity: { tagline: "new tag" } },
  });
  expect(out.identity.name).toBe("Mosis"); // base name fell through
  expect(out.identity.tagline).toBe("new tag");
  expect(out.identity.description).toBeUndefined(); // dropped: identity section replaced
  expect(out.persona.personality).toBe("new pers");
  expect(out.persona.scenario).toBeUndefined(); // dropped: persona section replaced
  expect(out.prompts.systemPrompt).toBe("base sys"); // untouched section inherits
  expect(out.greetings.firstMessage).toBe("base hi"); // untouched section inherits
});

test("applyVariant does not mutate the base (incl. nested objects)", () => {
  const snapshot = JSON.stringify(base);
  applyVariant(base, { id: "v1", overrides: { identity: { name: "X" }, persona: { voice: { provider: "openai" } } } });
  expect(JSON.stringify(base)).toBe(snapshot);
});
