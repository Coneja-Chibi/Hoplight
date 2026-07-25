/**
 * Pygmalion flat JSON adapter tests.
 */
import { test, expect } from "bun:test";
import { characterAdapter as adapter, isPygmalionCard, detectPygmalion } from "./index";
import { characterAdapter as sillytavern } from "../sillytavern/index";
import { characterAdapter as agnai } from "../agnai/index";
import { emitBundle } from "../../convert";
import { embedCharacterJson } from "../_shared/png";
import { loadFormats, registry } from "../../core";

const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const REPLACEMENT_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

test("export honesty reports a portrait that JSON cannot carry", () => {
  const ent = adapter.toCanonical(asInput(classicCard()));
  ent.body.media.portrait = {
    role: "portrait",
    ref: "https://cdn.example/mira.jpg",
    mime: "image/jpeg",
    primary: true,
  };

  const out = emitBundle(adapter, ent);
  expect(out.suggestedExtension).toBe("json");
  expect(out.report?.dropped.some((path) => path.startsWith("media.portrait"))).toBe(true);
});

test("a canonical PNG portrait becomes the carrier unless JSON was requested", () => {
  const ent = adapter.toCanonical(asInput(classicCard()));
  ent.body.media.portrait = {
    role: "portrait",
    ref: `data:image/png;base64,${TINY_PNG}`,
    mime: "image/png",
    primary: true,
  };

  const png = emitBundle(adapter, ent);
  expect(png.suggestedExtension).toBe("png");
  expect(png.bytes).toBeDefined();
  expect(png.report?.dropped.some((path) => path.startsWith("media.portrait"))).toBe(false);

  const json = emitBundle(adapter, ent, [], "json");
  expect(json.suggestedExtension).toBe("json");
  expect(json.report?.dropped.some((path) => path.startsWith("media.portrait"))).toBe(true);
});

test("PNG round-trip preserves its carrier, while clearing the portrait emits JSON", () => {
  const source = embedCharacterJson(
    new Uint8Array(Buffer.from(TINY_PNG, "base64")),
    JSON.stringify(classicCard()),
    "chara",
  );
  const ent = adapter.toCanonical({ bytes: source });

  const kept = emitBundle(adapter, ent);
  expect(kept.suggestedExtension).toBe("png");
  expect(adapter.detect({ bytes: kept.bytes })).toBe(1);

  ent.body.media.portrait = undefined;
  const cleared = emitBundle(adapter, ent);
  expect(cleared.suggestedExtension).toBe("json");
  expect(cleared.bytes).toBeUndefined();
});

test("replacing an imported portrait replaces the PNG carrier", () => {
  const source = embedCharacterJson(
    new Uint8Array(Buffer.from(TINY_PNG, "base64")),
    JSON.stringify(classicCard()),
    "chara",
  );
  const ent = adapter.toCanonical({ bytes: source });
  ent.body.media.portrait = {
    role: "portrait",
    ref: `data:image/png;base64,${REPLACEMENT_PNG}`,
    mime: "image/png",
    primary: true,
  };

  const out = emitBundle(adapter, ent);
  const expected = embedCharacterJson(
    new Uint8Array(Buffer.from(REPLACEMENT_PNG, "base64")),
    JSON.stringify(classicCard(), null, 2),
    "chara",
  );
  expect(out.bytes).toEqual(expected);
});

test("explicit PNG export fails when no valid inline PNG portrait exists", () => {
  const missing = adapter.toCanonical(asInput(classicCard()));
  expect(() => emitBundle(adapter, missing, [], "png")).toThrow(
    "pygmalion: PNG export requires a valid inline PNG portrait",
  );

  missing.body.media.portrait = {
    role: "portrait",
    ref: `data:image/png;base64,${TINY_PNG}=`,
    mime: "image/png",
    primary: true,
  };
  expect(() => emitBundle(adapter, missing, [], "png")).toThrow(
    "pygmalion: PNG export requires a valid inline PNG portrait",
  );

  missing.body.media.portrait.ref = "data:image/png;base64,bm90IGEgcG5n";
  expect(() => emitBundle(adapter, missing, [], "png")).toThrow(
    "pygmalion: PNG export requires a valid inline PNG portrait",
  );
});

test("a signature-only corrupt carrier falls back to JSON or fails an explicit PNG request", () => {
  const corrupt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const ent = adapter.toCanonical(asInput(classicCard()));
  ent.body.media.portrait = {
    role: "portrait",
    ref: `data:image/png;base64,${corrupt.toString("base64")}`,
    mime: "image/png",
    primary: true,
  };

  const fallback = emitBundle(adapter, ent);
  expect(fallback.suggestedExtension).toBe("json");
  expect(fallback.report?.dropped.some((path) => path.startsWith("media.portrait"))).toBe(true);
  expect(() => emitBundle(adapter, ent, [], "PNG")).toThrow(
    "pygmalion: PNG export requires a valid inline PNG portrait",
  );
});

test("the registry advertises Pygmalion as a PNG target", async () => {
  await loadFormats();
  expect(registry.targetsForExtension("png").map((target) => target.id)).toContain("pygmalion");
});
