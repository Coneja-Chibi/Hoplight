import { test, expect } from "bun:test";
import { characterAdapter as adapter } from "./index";
import { characterAdapter as sillytavern } from "../sillytavern/index";

/** A full Agnai card with a structured (wpp) persona and Agnai-only fields to preserve. */
function wppCard() {
  return {
    kind: "character",
    _id: "abc123",
    userId: "u1",
    name: "Vera",
    description: "A wandering cartographer.",
    appearance: "tall, ink-stained fingers",
    persona: { kind: "wpp", attributes: { Personality: ["curious", "dry"], Likes: ["maps"] } },
    greeting: "You again.",
    scenario: "at a crossroads inn",
    sampleChat: "<START>\n{{user}}: hi\n{{char}}: hm.",
    alternateGreetings: ["Oh. It's you.", "Lost again?"],
    systemPrompt: "stay terse",
    postHistoryInstructions: "no lists",
    insert: { depth: 3, prompt: "stay in character" },
    prefill: "Sure,",
    creator: "chi",
    characterVersion: "1.0",
    tags: ["adventure", "oc"],
    createdAt: "2020-01-01",
    updatedAt: "2021-01-01",
    extensions: { foo: "bar" },
  };
}

const asInput = (c: unknown) => ({ text: JSON.stringify(c) });

test("detect recognizes an Agnai card and rejects our native wrapper", () => {
  expect(adapter.detect(asInput(wppCard()))).toBe(1);
  // vaud-json shape (schemaVersion + body) must NOT read as Agnai
  expect(adapter.detect(asInput({ kind: "character", schemaVersion: "1", body: {} }))).toBe(0);
  expect(adapter.detect({ text: "not json" })).toBe(0);
});

test("toCanonical maps Agnai fields, including the structured persona", () => {
  const ent = adapter.toCanonical(asInput(wppCard()));
  expect(ent.id).toBe("vera");
  expect(ent.body.identity.name).toBe("Vera");
  expect(ent.body.persona.appearance).toBe("tall, ink-stained fingers");
  expect(ent.body.persona.structured).toEqual({
    kind: "wpp",
    attributes: { Personality: ["curious", "dry"], Likes: ["maps"] },
  });
  expect(ent.body.greetings.firstMessage).toBe("You again.");
  expect(ent.body.greetings.alternateGreetings).toEqual([{ text: "Oh. It's you." }, { text: "Lost again?" }]);
  expect(ent.body.prompts.depthInjections).toEqual([{ text: "stay in character", depth: 3 }]);
  expect(ent.body.attribution.creator).toBe("chi");
});

test("round-trip is lossless: a wpp card deep-equals through canonical + back", () => {
  const original = wppCard();
  const ent = adapter.toCanonical(asInput(original));
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  expect(JSON.parse(out.text!)).toEqual(original);
});

test("a text-persona card round-trips through personality", () => {
  const card = { ...wppCard(), persona: { kind: "text", attributes: { text: ["curious and dry"] } } };
  const ent = adapter.toCanonical(asInput(card));
  expect(ent.body.persona.personality).toBe("curious and dry");
  expect(ent.body.persona.structured).toEqual({ kind: "text" });
  expect(JSON.parse(adapter.fromCanonical(ent).text!)).toEqual(card);
});

test("canonical model bridges Agnai -> SillyTavern (non-Tavern to Tavern)", () => {
  const ent = adapter.toCanonical(asInput(wppCard()));
  const st = sillytavern.fromCanonical(ent);
  const card = JSON.parse(st.text!);
  expect(card.spec).toBe("chara_card_v2");
  expect(card.data.name).toBe("Vera");
  expect(card.data.first_mes).toBe("You again.");
  expect(card.data.scenario).toBe("at a crossroads inn");
});
