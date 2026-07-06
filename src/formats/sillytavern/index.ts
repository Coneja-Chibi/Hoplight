/**
 * SillyTavern character-card adapter (V1/V2/V3, PNG or JSON).
 * Version detection adapted from RoleCall's parse-v2.ts; field mapping is the shared
 * Tavern mapping (../_shared/tavern-fields). Lossless: the whole original card rides in escrow.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { embedCharacterBook } from "../_shared/character-book";
import coverage from "./coverage";
import lorebookCodec from "./lorebook";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { getVersion, pngSourceMedia } from "../_shared/png";
import { readCardJson } from "../_shared/card-io";
import { assetsToMedia } from "../_shared/assets";
import {
  type TavernData,
  dataToBody,
  applyBodyToData,
  wrapV2,
  wrapV3,
  CARD_SPEC_V2,
  CARD_SPEC_V3,
} from "../_shared/tavern-fields";

export { embedCharacterJson } from "../_shared/png";

type Variant = "v2" | "v3" | "v1" | "flat";

const VARIANTS: readonly Variant[] = ["v2", "v3", "v1", "flat"];

/** Read the round-trip variant back out of untyped escrow, coercing anything unknown to "v2". */
function toVariant(v: unknown): Variant {
  return typeof v === "string" && (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : "v2";
}

interface Detected {
  card: Record<string, unknown>;
  data: TavernData;
  variant: Variant;
}

/** Recognize the card shape and pull out the V2/V3 `data` object. */
function detectCard(json: unknown): Detected | null {
  if (!json || typeof json !== "object") return null;
  const card = json as Record<string, unknown>;
  if (card.spec === CARD_SPEC_V3 && card.data && typeof card.data === "object") {
    return { card, data: card.data as TavernData, variant: "v3" };
  }
  if (card.spec === CARD_SPEC_V2 && card.data && typeof card.data === "object") {
    return { card, data: card.data as TavernData, variant: "v2" };
  }
  if (card.spec === undefined && card.data === undefined && typeof card.name === "string") {
    const looksV2 =
      "alternate_greetings" in card ||
      "system_prompt" in card ||
      "post_history_instructions" in card ||
      "creator_notes" in card ||
      "extensions" in card ||
      "character_version" in card;
    // A flat/v1 card must carry a real character signal, not just a `name`. This is the cross-kind
    // firewall: an ST worldbook is also `{ name, ... }` json, so without this it false-positives as a
    // v1 character and collides with the lorebook adapter. A lorebook has none of these fields.
    const looksV1 =
      "description" in card ||
      "personality" in card ||
      "scenario" in card ||
      "first_mes" in card ||
      "mes_example" in card;
    if (!looksV2 && !looksV1) return null;
    return { card, data: card as TavernData, variant: looksV2 ? "flat" : "v1" };
  }
  return null;
}

const adapter: CharacterAdapter = {
  id: "sillytavern",
  label: "SillyTavern character card (v2/v3, png/json)",
  outputExtensions: ["json"],
  kind: "character",
  coverage,
  generic: true, // the generic Tavern/CC reader: its cards chip as "Default", not a platform

  // 0.9, not 1.0: SillyTavern is the generic Tavern reader. More-specific adapters (RoleCall) claim
  // 1.0 on the same card so they win detection and get to map their own extension block.
  detect(input: AdapterInput): number {
    // A PNG-embedded card wins on bytes; otherwise fall through to JSON (text, or non-PNG bytes) -
    // a real .json read carries both, so do NOT stop at the bytes branch (see readCardJson).
    if (input.bytes && getVersion(input.bytes)) return 0.9;
    return detectCard(readCardJson(input)) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    const json = readCardJson(input);
    const det = json ? detectCard(json) : null;
    if (!det) throw new Error("sillytavern: not a recognizable character card");
    const body = dataToBody(det.data);
    body.media = assetsToMedia(det.data.assets); // CCv3 assets[]; a no-op ({}) for V1/V2
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(det.data.name),
      body,
      escrow: {
        // a PNG card's pixels are authored art: keep the carrier as the raw-bytes twin
        sillytavern: { raw: json, unmapped: { variant: det.variant }, sourceMedia: pngSourceMedia(input.bytes) },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const esc = entity.escrow?.sillytavern;
    const variant = toVariant(esc?.unmapped?.["variant"]);
    const rawCard = esc?.raw as Record<string, unknown> | undefined;

    const base: TavernData =
      rawCard && (variant === "v2" || variant === "v3")
        ? { ...(rawCard.data as TavernData) }
        : rawCard
          ? { ...(rawCard as TavernData) }
          : {};
    applyBodyToData(base, entity.body);

    // Re-embed referenced lorebooks into the card's one character_book slot (shared by every CCv3
    // card writer), sourcing each book's twin from ITS OWN escrow, not this card's stale copy.
    if (context?.lorebooks?.length) embedCharacterBook(base as Record<string, unknown>, context.lorebooks);

    let out: unknown;
    if (rawCard && (variant === "v2" || variant === "v3")) out = { ...rawCard, data: base };
    else if (variant === "v3") out = wrapV3(base);
    else if (variant === "flat" || variant === "v1") out = base;
    else out = wrapV2(base);

    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

/** The SillyTavern family's character codec, exported by name for direct importers (tests, bundle). */
export { adapter as characterAdapter };

/** Folders-as-schema: this format family exports every codec it provides (character + world info). */
export default [adapter, lorebookCodec];
