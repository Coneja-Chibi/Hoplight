/**
 * Pygmalion flat JSON adapter tests.
 */
import { test, expect } from "bun:test";
import { characterAdapter as adapter, isPygmalionCard, detectPygmalion } from "./index";
import { characterAdapter as sillytavern } from "../sillytavern/index";
import { characterAdapter as agnai } from "../agnai/index";

function classicCard() {
  return {
    char_name: "Mira",
    char_persona: "A quiet cartographer who inks maps by lamplight.",
    char_greeting: "You found the attic again.",
    world_scenario: "A rain-soaked port city, late evening.",
    example_dialogue: "{{user}}: Hi\n{{char}}: Hello.",
    metadata: { tool: { name: "aichar", version: "1.0" } },
  };
}

const asInput = (c: unknown) => ({ text: JSON.stringify(c) });

test("isPygmalionCard accepts classic flat keys", () => {
  expect(isPygmalionCard(classicCard())).toBe(true);
  expect(isPygmalionCard({ char_name: "A", char_persona: "x" })).toBe(true);
});

test("isPygmalionCard rejects ST CCv2, Agnai, vaud-json, Backyard", () => {
  expect(isPygmalionCard({
    spec: "chara_card_v2",
    data: { name: "A", first_mes: "hi", char_persona: "nope" },
  })).toBe(false);
  expect(isPygmalionCard({
    kind: "character",
    persona: { kind: "text", attributes: { text: [""] } },
    greeting: "hi",
  })).toBe(false);
  expect(isPygmalionCard({
    schemaVersion: "1",
    body: {},
    char_persona: "x",
    char_greeting: "y",
  })).toBe(false);
  expect(isPygmalionCard({ aiName: "A", aiPersona: "x" })).toBe(false);
});

test("detect scores classic 1 and ST/Agnai 0 for our input", () => {
  expect(detectPygmalion(asInput(classicCard()))).toBe(1);
  expect(adapter.detect(asInput({
    spec: "chara_card_v2",
    data: { name: "A", first_mes: "hi" },
  }))).toBe(0);
  expect(sillytavern.detect(asInput(classicCard()))).toBe(0);
  expect(agnai.detect(asInput(classicCard()))).toBe(0);
});

test("toCanonical maps the five fields", () => {
  const ent = adapter.toCanonical(asInput(classicCard()));
  expect(ent.id).toBe("mira");
  expect(ent.body.identity.name).toBe("Mira");
  expect(ent.body.persona.personality).toBe("A quiet cartographer who inks maps by lamplight.");
  expect(ent.body.identity.description).toBe(ent.body.persona.personality);
  expect(ent.body.greetings.firstMessage).toBe("You found the attic again.");
  expect(ent.body.persona.scenario).toBe("A rain-soaked port city, late evening.");
  expect(ent.body.examples.exampleMessages).toBe("{{user}}: Hi\n{{char}}: Hello.");
  expect(ent.original?.pygmalion?.raw).toEqual(classicCard());
});

test("round-trip is lossless for classic card including metadata", () => {
  const original = classicCard();
  const ent = adapter.toCanonical(asInput(original));
  const out = adapter.fromCanonical(ent);
  expect(out.suggestedExtension).toBe("json");
  expect(JSON.parse(out.text!)).toEqual(original);
});

test("edit reaches the wire; metadata survives", () => {
  const ent = adapter.toCanonical(asInput(classicCard()));
  ent.body.identity.name = "Mira Voss";
  ent.body.greetings.firstMessage = "Back so soon?";
  const out = JSON.parse(adapter.fromCanonical(ent).text!);
  expect(out.char_name).toBe("Mira Voss");
  expect(out.name).toBeUndefined(); // classic cards only use char_name
  expect(out.char_greeting).toBe("Back so soon?");
  expect(out.metadata).toEqual({ tool: { name: "aichar", version: "1.0" } });
});

test("name alias: name without char_name still maps when persona+greeting present", () => {
  const card = {
    name: "OnlyName",
    char_persona: "p",
    char_greeting: "g",
    world_scenario: "s",
  };
  expect(isPygmalionCard(card)).toBe(true);
  const ent = adapter.toCanonical(asInput(card));
  // char_name absent; name alone does not fill char_name path unless we use name as fallback - cardToBody uses char_name ?? name
  expect(ent.body.identity.name).toBe("OnlyName");
});

test("cross-format: Pygmalion -> SillyTavern keeps core text", () => {
  const ent = adapter.toCanonical(asInput(classicCard()));
  const st = sillytavern.fromCanonical(ent);
  const card = JSON.parse(st.text!);
  expect(card.spec).toBe("chara_card_v2");
  expect(card.data.name).toBe("Mira");
  expect(card.data.first_mes).toBe("You found the attic again.");
  expect(card.data.personality).toBe("A quiet cartographer who inks maps by lamplight.");
});
