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
    creator: "ada",
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
  expect(ent.body.attribution.creator).toBe("ada");
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

// -- De-escrow: authored Agnai config blocks (voice/sprite/culture/imageSettings affixes/json) are
// first-class canonical slots. Wire shapes verified against agnai common/types (service discriminator,
// FLAT FullSprite, BaseImageSettings affixes). No public native export carries these (user-local), so
// the fixture is type-grounded; see samples/agnai/SOURCES.md. --

function makeRichAgnaiCard() {
  return {
    kind: "character",
    name: "Robot",
    culture: "japanese",
    visualType: "sprite",
    sprite: { body: "body_1", front_hair: "hair_2", gender: "female", hairColor: "#f0e0d0" },
    voice: { service: "elevenlabs", voiceId: "EL-123", rate: 1.1, stability: 0.5 },
    voiceDisabled: false,
    imageSettings: { prefix: "anime, ", negative: "blurry", steps: 30, cfg: 7 },
    json: { response: "{{text}}", schema: [{ name: "text", type: "string" }] },
    persona: { kind: "attributes", attributes: { personality: ["kind"] } },
    greeting: "hi",
    scenario: "cafe",
    sampleChat: "",
  };
}

test("de-escrow read: voice/sprite/culture/image affixes/json land in first-class slots", () => {
  const ent = adapter.toCanonical({ text: JSON.stringify(makeRichAgnaiCard()) });
  expect(ent.body.identity.culture).toBe("japanese");
  expect(ent.body.persona.voice).toEqual({
    provider: "elevenlabs",
    voiceId: "EL-123",
    rate: 1.1,
    extras: { stability: 0.5 },
  });
  expect(ent.body.media.visualKind).toBe("sprite");
  expect(ent.body.media.sprite).toEqual({
    parts: { body: "body_1", front_hair: "hair_2" },
    gender: "female",
    hairColor: "#f0e0d0",
  });
  expect(ent.body.persona.imagePrompt).toEqual({ prefix: "anime, ", negative: "blurry" });
  expect(ent.body.settings?.responseSchema).toEqual(makeRichAgnaiCard().json);
});

test("de-escrow round-trip: an unedited rich card deep-equals through canonical + back", () => {
  const card = makeRichAgnaiCard();
  const out = JSON.parse(adapter.fromCanonical(adapter.toCanonical({ text: JSON.stringify(card) })).text!);
  expect(out).toEqual(card);
});

test("de-escrow edit: mutating voice/culture/affixes reaches the wire, sampler knobs survive", () => {
  const ent = adapter.toCanonical({ text: JSON.stringify(makeRichAgnaiCard()) });
  ent.body.persona.voice!.voiceId = "EL-999";
  ent.body.identity.culture = "korean";
  ent.body.persona.imagePrompt!.prefix = "watercolor, ";
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.voice.voiceId).toBe("EL-999");
  expect(out.voice.stability).toBe(0.5); // extras survive the rebuild
  expect(out.culture).toBe("korean");
  expect(out.imageSettings.prefix).toBe("watercolor, ");
  expect(out.imageSettings.steps).toBe(30); // sampler knobs untouched (escrow-side of the merge)
  expect(out.imageSettings.cfg).toBe(7);
});
