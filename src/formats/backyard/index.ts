/**
 * Backyard.ai (formerly Faraday) format family:
 *  - legacy flat JSON (this file): aiName / aiPersona / customDialogue …
 *  - modern .byaf archive: ./byaf.ts
 * Placeholders on legacy cards are single-brace ({character}/{user}); converted to {{char}}/{{user}}
 * for the canonical model (lossy inverse — original keeps unedited text verbatim).
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type { CanonicalCharacter, CharacterBody } from "../../entities/character/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import coverage from "./coverage";
import { byafAdapter } from "./byaf";

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** First non-empty string among the given keys (Backyard uses several aliases per concept). */
function firstStr(o: Rec, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

/**
 * Backyard single-brace -> Tavern double-brace. {character}/{user} first, then a bare {char}
 * fallback. The fallback uses lookarounds so it matches a genuine single-brace {char} and NEVER the
 * inner {char} of an already-converted {{char}} (the reference importer corrupts that to {{{char}}};
 * we deliberately do not, keeping the canonical text clean for cross-format output).
 */
const toTavern = (s: string): string =>
  s
    .replace(/\{character\}/gi, "{{char}}")
    .replace(/\{user\}/gi, "{{user}}")
    .replace(/(?<!\{)\{char\}(?!\})/gi, "{{char}}");

/** Tavern double-brace -> Backyard single-brace (the lossy inverse; only used for edited fields). */
const toBackyard = (s: string): string =>
  s.replace(/\{\{char\}\}/gi, "{character}").replace(/\{\{user\}\}/gi, "{user}");

const conv = (s: string | undefined): string | undefined => (s === undefined ? undefined : toTavern(s));

const NAME_KEYS = ["aiDisplayName", "aiName", "displayName", "name"] as const;
const DESC_KEYS = ["aiPersona", "description", "persona"] as const;
const FIRST_KEYS = ["firstMessage", "greeting", "first_mes"] as const;
const EXAMPLE_KEYS = ["customDialogue", "examples", "mes_example"] as const;
const SYSTEM_KEYS = ["systemPrompt", "system_prompt"] as const;

function cardToBody(o: Rec): CharacterBody {
  const name = firstStr(o, NAME_KEYS) ?? "";
  // aiName is the {{char}} SHORTHAND, a distinct authored field from the display name (the exact concept
  // Identity.nickname exists for). Carry it only when it actually differs, so equal-name cards stay clean.
  const aiName = firstStr(o, ["aiName"]);
  return {
    identity: {
      name,
      nickname: aiName !== undefined && aiName !== name ? aiName : undefined,
      description: conv(firstStr(o, DESC_KEYS)),
      // Backyard `version`; do not synthesize a default on parse (leave unset if absent).
      characterVersion: firstStr(o, ["version"]),
    },
    persona: {
      personality: conv(firstStr(o, ["personality"])),
      scenario: conv(firstStr(o, ["scenario"])),
    },
    prompts: { systemPrompt: conv(firstStr(o, SYSTEM_KEYS)) },
    greetings: { firstMessage: conv(firstStr(o, FIRST_KEYS)) },
    examples: { exampleMessages: conv(firstStr(o, EXAMPLE_KEYS)) },
    media: {},
    attribution: { creator: firstStr(o, ["creator"]) },
    discovery: { tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : undefined },
  };
}

/**
 * Serialize one canonical field back to a Backyard key. If the source field is unedited since parse
 * (its canonical value equals what parse would recompute from the raw text), re-emit the raw bytes
 * verbatim so the non-bijective placeholder conversion cannot corrupt an untouched card; otherwise
 * write a fresh (lossy) conversion of the edited canonical value.
 */
function fieldOut(card: Rec, rawKey: string, canonical: string | undefined): string | undefined {
  if (canonical === undefined) return undefined;
  const rawVal = card[rawKey];
  if (typeof rawVal === "string" && toTavern(rawVal) === canonical) return rawVal;
  return toBackyard(canonical);
}

const adapter: CharacterAdapter = {
  id: "backyard",
  label: "Backyard.ai / Faraday character (legacy json)",
  outputExtensions: ["json"],
  kind: "character",
  coverage,
  // Legacy flat JSON only. Modern product surface is .byaf (id `byaf`) on the lens strip.
  lens: false,

  // Strong, Backyard-unique keys score high; the bare-persona heuristic is weak and must not fire on
  // an Agnai card (kind: "character"). Both stay below the Tavern/RC/Agnai adapters on a shared input.
  detect(input: AdapterInput): number {
    if (input.text == null) return 0;
    let o: unknown;
    try {
      o = JSON.parse(input.text);
    } catch {
      return 0;
    }
    if (!isRecord(o)) return 0;
    if (["aiName", "aiPersona", "aiDisplayName", "customDialogue"].some((k) => typeof o[k] === "string")) return 0.9;
    if (typeof o.persona === "string" && o.description === undefined && o.kind !== "character") return 0.55;
    return 0;
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    if (input.text == null) throw new Error("backyard: needs text input");
    const o = JSON.parse(input.text) as unknown;
    if (!isRecord(o)) throw new Error("backyard: not a Backyard character object");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(firstStr(o, NAME_KEYS)),
      body: cardToBody(o),
      original: { backyard: { raw: o } },
    };
  },

  fromCanonical(entity: CanonicalCharacter): AdapterOutput {
    const raw = entity.original?.backyard?.raw;
    const card: Rec = isRecord(raw) ? (structuredClone(raw) as Rec) : {};
    const b = entity.body;

    // display name and the {{char}} shorthand are DISTINCT authored fields: aiDisplayName carries the
    // name, aiName carries the nickname (falling back to the name when none). Stamping both with the
    // name, as the reference serializer does, destroys a distinct authored aiName - a fixed data-loss bug.
    card.aiDisplayName = b.identity.name;
    card.aiName = b.identity.nickname ?? b.identity.name;

    const set = (key: string, v: string | undefined): void => {
      if (v !== undefined) card[key] = v;
    };
    set("aiPersona", fieldOut(card, "aiPersona", b.identity.description));
    set("personality", fieldOut(card, "personality", b.persona.personality));
    set("scenario", fieldOut(card, "scenario", b.persona.scenario));
    set("firstMessage", fieldOut(card, "firstMessage", b.greetings.firstMessage));
    set("customDialogue", fieldOut(card, "customDialogue", b.examples.exampleMessages));
    set("systemPrompt", fieldOut(card, "systemPrompt", b.prompts.systemPrompt));
    set("creator", b.attribution.creator);
    if (b.discovery.tags) card.tags = b.discovery.tags;
    // Never fabricate `version` onto a twin that never had one (parse deliberately leaves it unset);
    // only a from-scratch cross-format card gets the "1.0" floor so it emits valid.
    if (b.identity.characterVersion !== undefined) card.version = b.identity.characterVersion;
    else if (!isRecord(raw)) card.version = "1.0";

    return { text: JSON.stringify(card, null, 2), suggestedExtension: "json" };
  },
};

/** Legacy flat-JSON adapter (named for tests + direct importers). */
export { adapter as characterAdapter, adapter as legacyAdapter };
export { byafAdapter };

/** Folders-as-schema: legacy JSON + modern .byaf archive. */
export default [adapter, byafAdapter];
