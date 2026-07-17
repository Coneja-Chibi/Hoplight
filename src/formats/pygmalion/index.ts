/**
 * Pygmalion flat character JSON (classic legacy + aichar / TextGen-WebUI exports).
 * Not Tavern CCv2/v3: bare keys char_name / char_persona / char_greeting / world_scenario /
 * example_dialogue. JSON standalone and PNG `chara` tEXt carrying that same flat JSON.
 * Research: docs/reference/platform-native-fields.md, design/FORMATS-LANDSCAPE.md Family 3.
 * Lossless: whole card rides in original.pygmalion.raw; PNG pixels in sourceMedia when present.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type { CanonicalCharacter, CharacterBody, MediaAsset } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readCardJson } from "../_shared/card-io";
import { getVersion, pngSourceMedia, embedCharacterJson } from "../_shared/png";
import coverage from "./coverage";

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * Classic Pygmalion shape (flat). Must not claim CCv2/v3, vaud-json, or Agnai.
 * Detect by char_* keys (HIGH confidence research).
 */
export function isPygmalionCard(json: unknown): json is Rec {
  if (!isRec(json)) return false;
  if (json.spec !== undefined || json.data !== undefined) return false;
  if (json.schemaVersion !== undefined || json.body !== undefined) return false;
  if (json.kind === "character") return false; // Agnai
  if (typeof json.aiName === "string" || typeof json.aiPersona === "string") return false; // Backyard

  const persona = str(json.char_persona) !== undefined;
  const greeting = str(json.char_greeting) !== undefined;
  const scenario = str(json.world_scenario) !== undefined;
  const classic = [persona, greeting, scenario].filter(Boolean).length;
  if (classic >= 2) return true;
  // Minimal: named character with persona blob
  if (str(json.char_name) !== undefined && persona) return true;
  return false;
}

/** Confidence for detect(): 1.0 on classic flat keys; 0 otherwise (JSON or PNG payload). */
export function detectPygmalion(input: AdapterInput): number {
  const json = readCardJson(input);
  if (json && isPygmalionCard(json)) return 1;
  // PNG with a chara chunk that is NOT our shape must not claim (ST will take CCv2)
  if (input.bytes && getVersion(input.bytes) && json && !isPygmalionCard(json)) return 0;
  return 0;
}

function cardToBody(card: Rec): CharacterBody {
  const name = str(card.char_name) ?? str(card.name) ?? "";
  const personaBlob = str(card.char_persona);
  return {
    identity: {
      name,
      // Mirror persona into description so shared UI that only shows description still has text.
      description: personaBlob,
    },
    persona: {
      personality: personaBlob,
      scenario: str(card.world_scenario),
    },
    prompts: {},
    greetings: {
      firstMessage: str(card.char_greeting),
    },
    examples: {
      exampleMessages: str(card.example_dialogue),
    },
    media: {},
    attribution: {},
    discovery: {},
  };
}

function applyBodyToCard(base: Rec, b: CharacterBody): Rec {
  const set = (k: string, v: string | undefined): void => {
    if (v !== undefined) base[k] = v;
  };
  set("char_name", b.identity.name);
  // Prefer personality; fall back to description (import mirrored both).
  const persona = b.persona.personality ?? b.identity.description;
  set("char_persona", persona);
  set("char_greeting", b.greetings.firstMessage);
  set("world_scenario", b.persona.scenario);
  set("example_dialogue", b.examples.exampleMessages);
  // Keep legacy `name` alias in sync only when the source already used it (do not invent the key).
  if (base.name !== undefined) set("name", b.identity.name);
  return base;
}

function baseCard(): Rec {
  return {
    char_name: "",
    char_persona: "",
    char_greeting: "",
    world_scenario: "",
    example_dialogue: "",
  };
}

/** Portrait from PNG carrier (pixels), not a wire key. */
function portraitFromPng(bytes: Uint8Array | undefined): MediaAsset | undefined {
  const sm = pngSourceMedia(bytes);
  if (!sm) return undefined;
  return {
    role: "portrait",
    ref: `data:${sm.mime};base64,${sm.b64}`,
    mime: sm.mime,
    primary: true,
  };
}

const adapter: CharacterAdapter = {
  id: "pygmalion",
  label: "Pygmalion character (flat JSON / PNG)",
  outputExtensions: ["json"],
  kind: "character",
  coverage,
  // Real codec; not a host-product lens tab (5 flat fields, no bag). Export/import only.
  lens: false,

  detect(input: AdapterInput): number {
    return detectPygmalion(input);
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    const json = readCardJson(input);
    if (!json || !isPygmalionCard(json)) {
      throw new Error("pygmalion: not a Pygmalion flat character (need char_persona / char_greeting / world_scenario)");
    }
    const body = cardToBody(json);
    const face = portraitFromPng(input.bytes);
    if (face) body.media.portrait = face;

    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(body.identity.name),
      body,
      original: {
        pygmalion: {
          raw: json,
          sourceMedia: pngSourceMedia(input.bytes),
        },
      },
    };
  },

  fromCanonical(entity: CanonicalCharacter): AdapterOutput {
    const esc = entity.original?.pygmalion;
    const raw = esc?.raw as Rec | undefined;
    const card = raw ? structuredClone(raw) : baseCard();
    applyBodyToCard(card, entity.body);
    const text = JSON.stringify(card, null, 2);

    // Re-embed into PNG carrier when we kept source pixels (same pattern as ST lineage).
    const sm = esc?.sourceMedia as { b64?: string; mime?: string } | undefined;
    if (sm && typeof sm.b64 === "string" && sm.mime === "image/png") {
      try {
        const png = Buffer.from(sm.b64, "base64");
        const bytes = embedCharacterJson(new Uint8Array(png), text, "chara");
        return { bytes, suggestedExtension: "png" };
      } catch {
        // fall through to JSON
      }
    }
    return { text, suggestedExtension: "json" };
  },
};

export { adapter as characterAdapter };
export default adapter;
