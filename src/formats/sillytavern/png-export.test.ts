/**
 * Writing the card people actually trade.
 *
 * A SillyTavern card moves between apps as a PNG with the card JSON in a tEXt chunk. This adapter
 * could read one and could not write one - `outputExtensions` said `json` only - so "export as PNG"
 * had no answer here, and the nearest thing was pygmalion, which writes a different card shape.
 *
 * THE TEST THAT MATTERS IS THE ROUND TRIP. Embedding is easy to do in a way that another reader
 * rejects: a wrong keyword, a mangled chunk, base64 of base64. So the assertion is not "we produced
 * bytes" - it is that our own reader takes those bytes back and returns the same character.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { characterAdapter } from "./index";
import { extractCharacterJson, getVersion } from "../_shared/png";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { dataToBody } from "../_shared/tavern-fields";
import { characterPngCard, pngCardRefusal } from "../_shared/card-png";

/**
 * A REAL PNG, read from the samples we already ship.
 *
 * The hand-written 1x1 byte array used elsewhere in this repo carries a bad IDAT CRC. That is
 * harmless in tests that never parse it and fatal here: the chunk reader validates CRCs, so
 * embedding into it throws before anything about the card is exercised. A carrier has to be a
 * carrier.
 */
const PNG = new Uint8Array(readFileSync("samples/sillytavern/characters/Seraphina.png"));

const dataUrl = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;

/**
 * Built through the adapter's OWN import path rather than hand-written.
 *
 * A literal body drifts from the schema the moment a field is added, and the first version of this
 * file died on a missing `greetings.firstMessage` - a fixture failure that says nothing about PNG.
 * `dataToBody` is what a real import produces, so the card under test is one the adapter could
 * actually have made.
 */
const card = (portrait: boolean): CanonicalCharacter => {
  const body = dataToBody({
    name: "Vera",
    description: "A lighthouse keeper who never sleeps.",
    personality: "Watchful, dry, kind under it.",
  } as never);
  if (portrait) body.media = { portrait: { ref: dataUrl } } as never;
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "vera",
    body,
    original: {},
  } as unknown as CanonicalCharacter;
};

describe("exporting a SillyTavern card as PNG", () => {
  test("the adapter offers png at all", () => {
    // The gap somebody reported: it could read PNG cards and never write one.
    expect(characterAdapter.outputExtensions).toContain("png");
  });

  test("A CARD EXPORTED AS PNG READS BACK AS THE SAME CHARACTER", () => {
    const out = characterAdapter.fromCanonical(card(true), { requestedExtension: "png" });
    expect(out.suggestedExtension).toBe("png");
    expect(out.bytes).toBeInstanceOf(Uint8Array);

    // Ours, and readable by anything that reads Tavern PNGs: the version marker is what they look for.
    expect(getVersion(out.bytes!)).not.toBeNull();

    const back = characterAdapter.toCanonical({ bytes: out.bytes!, filename: "vera.png" } as never);
    expect(back.body.identity.name).toBe("Vera");
    expect(back.body.identity.description).toContain("lighthouse keeper");
    expect(back.body.persona?.personality).toContain("Watchful");
  });

  test("the embedded JSON is the same card the json export writes", () => {
    // One card, two carriers. If these ever diverge, a PNG export is a second format pretending to
    // be the first, and the difference only shows up in somebody else's app.
    const asJson = characterAdapter.fromCanonical(card(true));
    const asPng = characterAdapter.fromCanonical(card(true), { requestedExtension: "png" });
    expect(extractCharacterJson(asPng.bytes!)).toBe(asJson.text ?? null);
  });

  test("JSON IS STILL JSON when nobody asked for a picture", () => {
    /**
     * Deliberately unlike pygmalion, which prefers PNG whenever a portrait exists. This is the
     * generic Tavern writer and most of what it emits is read by tools that want the text; silently
     * returning bytes from a .json export would break them.
     */
    const out = characterAdapter.fromCanonical(card(true));
    expect(out.suggestedExtension).toBe("json");
    expect(out.bytes).toBeUndefined();
  });

  test("a card with no portrait REFUSES rather than inventing a picture", () => {
    // The alternative is a blank carrier that looks like a real card until somebody opens it.
    expect(() => characterAdapter.fromCanonical(card(false), { requestedExtension: "png" }))
      .toThrow(/portrait/i);
  });
});

describe("every card version exports as PNG", () => {
  /** A card pinned to one round-trip variant, the way an imported card carries its own. */
  const at = (variant: string): CanonicalCharacter => {
    const c = card(true) as unknown as { original: Record<string, unknown> };
    c.original = { sillytavern: { raw: null, unmapped: { variant } } };
    return c as unknown as CanonicalCharacter;
  };

  for (const variant of ["v1", "flat", "v2", "v3"] as const) {
    test(`${variant} exports and reads back`, () => {
      const out = characterAdapter.fromCanonical(at(variant), { requestedExtension: "png" });
      expect(characterAdapter.toCanonical({ bytes: out.bytes!, filename: "v.png" } as never)
        .body.identity.name).toBe("Vera");
    });
  }

  test("A V3 CARD IS LABELLED V3, not merely readable as v2", () => {
    /**
     * The defect this pins shipped for one commit. `chara` is the v2 marker every reader knows and
     * `ccv3` is what a v3-aware reader looks for first, so writing only `chara` produced a v3 card
     * that announced itself as v2 - opening everywhere, and read by the older path in the one app
     * that would have understood its newer fields. The card was right; its label was wrong.
     */
    const v3 = characterAdapter.fromCanonical(at("v3"), { requestedExtension: "png" });
    expect(getVersion(v3.bytes!)).toBe("v3");
    // Still carries `chara` too, so nothing older loses the card.
    expect(extractCharacterJson(v3.bytes!)).toBe(characterAdapter.fromCanonical(at("v3")).text ?? null);

    const v2 = characterAdapter.fromCanonical(at("v2"), { requestedExtension: "png" });
    expect(getVersion(v2.bytes!)).toBe("v2");
  });
});

describe("a PNG card is a property of the character, not of a platform", () => {
  test("A CHARACTER FROM ANY FORMAT EXPORTS AS A STANDARD CARD", () => {
    /**
     * The asymmetry this closes: `card-io` reads a card out of a PNG for any adapter that asks, so
     * import already treated PNG as the ecosystem's carrier. Export made it a per-adapter opt-in
     * that two of nine had taken, so whether a character could become a picture depended on picking
     * the right platform first - which is the one thing somebody exporting a picture does not know.
     *
     * `original: {}` is the load-bearing part: this character never came from SillyTavern.
     */
    const anyCharacter = card(true);
    expect(anyCharacter.original).toEqual({});

    const bytes = characterPngCard(anyCharacter);
    expect(getVersion(bytes)).not.toBeNull();
    expect(characterAdapter.toCanonical({ bytes, filename: "any.png" } as never)
      .body.identity.name).toBe("Vera");
  });

  test("and it REFUSES in words when there is no portrait to carry it", () => {
    expect(pngCardRefusal(card(false))).toMatch(/portrait/i);
    expect(pngCardRefusal(card(true))).toBeNull();
    expect(() => characterPngCard(card(false))).toThrow(/portrait/i);
  });
});
