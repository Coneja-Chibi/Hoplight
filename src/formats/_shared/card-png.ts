/**
 * A character as the PNG card the whole ecosystem trades.
 *
 * PNG IS A CARRIER, NOT A PLATFORM'S OUTPUT FORMAT, and modelling it the other way was backwards.
 * The bytes inside a card PNG are the V2/V3 spec, which is what SillyTavern, Chub, Agnai, RisuAI,
 * Backyard and Pygmalion all parse on import - so "can this be a PNG" is a property of being a
 * character, not of which platform dialect you happen to be exporting through.
 *
 * OUR OWN IMPORT PATH ALREADY KNEW THIS. `card-io.ts` reads a card out of a PNG for any adapter that
 * asks, and four of them do. Export was the asymmetric half: two adapters had opted into writing one
 * and the other seven could not, so exporting the same character as PNG depended on picking the
 * right platform first - which is exactly the thing a person exporting a picture does not know.
 *
 * WHY NOT SIMPLY LET EVERY ADAPTER WRITE PNG. Because a PNG card announces itself as the standard
 * card. Putting Agnai's own JSON dialect, or RoleCall's, under the `chara` keyword produces a file
 * that claims to be something it is not, and the reader on the other side has no way to tell - seven
 * formats each lying in their own shape. There is one dialect every reader understands, so there is
 * one path here, and the platform adapters keep writing the containers their own apps want.
 */
import type { CanonicalCharacter } from "../../entities/character/schema";
import { characterAdapter as tavern } from "../sillytavern";
import { embedCardPng, portraitPngBytes } from "./png";
import { CARD_SPEC_V3 } from "./tavern-fields";

/** Why a character cannot become a PNG card, or null when it can. */
export function pngCardRefusal(entity: CanonicalCharacter): string | null {
  return portraitPngBytes(entity.body) ? null : "this card has no PNG portrait to carry it";
}

/**
 * The card, as PNG bytes. Throws with the reason above when it cannot be one.
 *
 * The JSON is built by the Tavern codec because that codec IS the standard dialect - not because the
 * character came from SillyTavern. A card imported from anywhere exports the same way, which is the
 * whole point: `original` may be empty and this still produces a card every app can open.
 */
export function characterPngCard(entity: CanonicalCharacter): Uint8Array {
  const portrait = portraitPngBytes(entity.body);
  if (!portrait) throw new Error(`png card: ${pngCardRefusal(entity) ?? "unavailable"}`);
  const out = tavern.fromCanonical(entity);
  const json = out.text;
  if (typeof json !== "string") throw new Error("png card: the card codec returned no json");

  /**
   * READ THE SPEC FIELD, NOT THE TEXT.
   *
   * This asked `json.includes("chara_card_v3")` for one commit, which is a different question: a v2
   * card whose description or creator notes happen to contain that string would have been wrapped in
   * a `ccv3` chunk announcing v3 while carrying v2 JSON - the exact mislabel that was just fixed on
   * the adapter's own branch, reintroduced here by a substring.
   *
   * A card that will not parse is not a card, so it fails rather than guessing at a version.
   */
  let spec: unknown;
  try {
    spec = (JSON.parse(json) as { spec?: unknown }).spec;
  } catch {
    throw new Error("png card: the card codec returned json that does not parse");
  }
  return embedCardPng(portrait, json, spec === CARD_SPEC_V3);
}
