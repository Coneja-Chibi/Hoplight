import { test, expect } from "bun:test";
import adapter from "./index";
import { characterAdapter as sillytavern } from "../sillytavern/index";

/** A legacy Backyard/Faraday flat card with single-brace placeholders in the prompt fields. */
function makeBackyardCard() {
  return {
    aiName: "Vera",
    aiDisplayName: "Vera",
    aiPersona: "{character} is a wandering cartographer who greets {user} warmly.",
    personality: "curious, dry",
    scenario: "at a crossroads inn",
    firstMessage: "You again, {user}.",
    customDialogue: "{user}: hi\n{character}: hm.",
    systemPrompt: "stay terse",
    creator: "ada",
    tags: ["adventure", "oc"],
    version: "2.1",
  };
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("detect: strong Backyard keys score high, the bare-persona heuristic is weak and skips Agnai/CCv2", () => {
  expect(adapter.detect(asText(makeBackyardCard()))).toBe(0.9);
  expect(adapter.detect(asText({ persona: "x" }))).toBe(0.55);
  // an Agnai card (kind: "character") must NOT trip the weak persona clause
  expect(adapter.detect(asText({ kind: "character", persona: "x", greeting: "hi" }))).toBe(0);
  // a CCv2 card is not Backyard
  expect(adapter.detect(asText({ spec: "chara_card_v2", data: { name: "x" } }))).toBe(0);
  expect(adapter.detect({ text: "not json" })).toBe(0);
});

test("toCanonical maps fields and converts single-brace placeholders to Tavern double-brace", () => {
  const ent = adapter.toCanonical(asText(makeBackyardCard()));
  expect(ent.id).toBe("vera");
  expect(ent.body.identity.name).toBe("Vera");
  expect(ent.body.identity.description).toBe("{{char}} is a wandering cartographer who greets {{user}} warmly.");
  expect(ent.body.greetings.firstMessage).toBe("You again, {{user}}.");
  expect(ent.body.examples.exampleMessages).toBe("{{user}}: hi\n{{char}}: hm.");
  expect(ent.body.identity.characterVersion).toBe("2.1");
  expect(ent.body.discovery.tags).toEqual(["adventure", "oc"]);
});

test("round-trip is lossless for an unedited card: placeholders survive verbatim", () => {
  const original = makeBackyardCard();
  const ent = adapter.toCanonical(asText(original));
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  // the non-bijective placeholder conversion must NOT corrupt an untouched field
  expect(JSON.parse(out.text!)).toEqual(original);
});

test("an edited field re-converts to Backyard single-brace on serialize", () => {
  const ent = adapter.toCanonical(asText(makeBackyardCard()));
  ent.body.identity.description = "{{char}} now runs the inn for {{user}}.";
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.aiPersona).toBe("{character} now runs the inn for {user}.");
});

// The {char}/{{char}} conversion is non-bijective, so verbatim round-trip for UNEDITED fields is the
// load-bearing guarantee. Prove it over a corpus of adversarial placeholder combos, not one fixture.
const PLACEHOLDER_CORPUS = [
  "{character} meets {user}",
  "{char} beside {{char}}",
  "{{char}} already tavern, {{user}} too",
  "mixed case {Character} {USER} {Char}",
  "nested {{char}} plus bare {char} plus {character}",
  "no placeholders at all",
  "{user}{user}{{char}}{char}",
  "triple {{{char}}} weirdness",
];

for (const text of PLACEHOLDER_CORPUS) {
  test(`placeholder round-trip preserves an unedited field verbatim: ${JSON.stringify(text)}`, () => {
    const card = { aiName: "N", aiPersona: text };
    const ent = adapter.toCanonical(asText(card));
    const out = JSON.parse(adapter.fromCanonical(ent).text!);
    expect(out.aiPersona).toBe(text);
  });
}

test("unknown/foreign Backyard keys survive the round-trip via escrow", () => {
  const card = { ...makeBackyardCard(), faradayOnly: { mirostat: 2 }, someArray: [1, 2, 3] };
  const ent = adapter.toCanonical(asText(card));
  expect(JSON.parse(adapter.fromCanonical(ent).text!)).toEqual(card);
});

// -- De-escrow WB-1: the aiName SHORTHAND is a distinct authored field ({{char}} override), not a copy
// of the display name. The old serializer stamped both keys with identity.name, destroying a distinct
// aiName that escrow had preserved - active data loss the fixture hid by using equal names. --

test("WB-1 read: a distinct aiName lands in identity.nickname, aiDisplayName stays the name", () => {
  const ent = adapter.toCanonical(asText({ aiName: "V", aiDisplayName: "Vera", aiPersona: "x" }));
  expect(ent.body.identity.name).toBe("Vera");
  expect(ent.body.identity.nickname).toBe("V");
});

test("WB-1 loss: an unedited round-trip must NOT clobber a distinct aiName", () => {
  const card = { aiName: "V", aiDisplayName: "Vera", aiPersona: "x" };
  const out = JSON.parse(adapter.fromCanonical(adapter.toCanonical(asText(card))).text!);
  expect(out.aiName).toBe("V"); // was "Vera" before the fix - the clobber
  expect(out.aiDisplayName).toBe("Vera");
});

test("WB-1 edit: mutating the nickname reaches the aiName wire, display name untouched", () => {
  const ent = adapter.toCanonical(asText({ aiName: "V", aiDisplayName: "Vera", aiPersona: "x" }));
  ent.body.identity.nickname = "Vixen";
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.aiName).toBe("Vixen");
  expect(out.aiDisplayName).toBe("Vera");
});

test("no version fabrication: a twin card without `version` does not gain one on round-trip", () => {
  const card = { aiName: "N", aiPersona: "x" };
  const out = JSON.parse(adapter.fromCanonical(adapter.toCanonical(asText(card))).text!);
  expect("version" in out).toBe(false);
});

test("canonical model bridges Backyard -> SillyTavern with Tavern placeholders intact", () => {
  const ent = adapter.toCanonical(asText(makeBackyardCard()));
  const card = JSON.parse(sillytavern.fromCanonical(ent).text!);
  expect(card.spec).toBe("chara_card_v2");
  expect(card.data.name).toBe("Vera");
  expect(card.data.description).toBe("{{char}} is a wandering cartographer who greets {{user}} warmly.");
  expect(card.data.first_mes).toBe("You again, {{user}}.");
});
