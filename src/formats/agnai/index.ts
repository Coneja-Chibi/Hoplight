/**
 * Agnai (Agnaistic) character adapter. Agnai is a JSON format with its own shape, NOT Tavern-lineage:
 * its persona is structured (kind + attributes: boostyle/wpp/sbf/attributes/text), which is exactly
 * the canonical `persona.structured` field. Schema read from Agnai source (common/types/library.ts,
 * common/adapters.ts; AGPL-3.0) as interop facts only - no Agnai code is copied. Lossless: the whole
 * original card rides in escrow.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter, CharacterBody, Persona } from "../../entities/character/schema";
import type { CanonicalLorebook, LorebookBody } from "../../entities/lorebook/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import lorebookCodec, {
  coerceMemoryBook,
  memoryBookToCanonical,
  canonicalToMemoryBook,
  type MemoryBook,
} from "./lorebook";

/** Agnai persona formats (common/adapters.ts PERSONA_FORMATS). */
type PersonaFormat = "boostyle" | "wpp" | "sbf" | "attributes" | "text";

interface AgnaiPersona {
  kind: PersonaFormat;
  attributes: Record<string, string[]>;
}

interface AgnaiCard extends Record<string, unknown> {
  kind?: "character";
  name?: string;
  description?: string;
  appearance?: string;
  persona: AgnaiPersona;
  greeting?: string;
  scenario?: string;
  sampleChat?: string;
  alternateGreetings?: string[];
  systemPrompt?: string;
  postHistoryInstructions?: string;
  insert?: { depth: number; prompt: string };
  prefill?: string;
  creator?: string;
  characterVersion?: string;
  tags?: string[];
  /** Agnai's native embedded lorebook (a MemoryBook); present in native downloads that have lore. */
  characterBook?: unknown;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : undefined;

/** Agnai persona -> canonical persona (structured for attribute kinds; plain text for "text"). */
function toStructured(p: AgnaiPersona): Pick<Persona, "personality" | "structured"> {
  if (p.kind === "text") {
    return { personality: p.attributes?.text?.[0], structured: { kind: "text" } };
  }
  return { structured: { kind: p.kind, attributes: p.attributes ?? {} } };
}

/** Canonical persona -> Agnai persona (round-trips attribute kinds; falls back to a text persona). */
function toAgnaiPersona(body: CharacterBody): AgnaiPersona {
  const s = body.persona.structured;
  if (s && s.kind !== "text") return { kind: s.kind, attributes: s.attributes };
  return { kind: "text", attributes: { text: [body.persona.personality ?? ""] } };
}

function cardToBody(c: AgnaiCard): CharacterBody {
  const persona = toStructured(c.persona ?? { kind: "text", attributes: { text: [""] } });
  return {
    identity: {
      name: str(c.name) ?? "",
      description: str(c.description),
      characterVersion: str(c.characterVersion),
    },
    persona: {
      personality: persona.personality,
      scenario: str(c.scenario),
      appearance: str(c.appearance),
      structured: persona.structured,
    },
    prompts: {
      systemPrompt: str(c.systemPrompt),
      postHistoryInstructions: str(c.postHistoryInstructions),
      prefill: str(c.prefill),
      depthInjections: c.insert ? [{ text: c.insert.prompt, depth: c.insert.depth }] : undefined,
    },
    greetings: {
      firstMessage: str(c.greeting),
      alternateGreetings: strList(c.alternateGreetings)?.map((text) => ({ text })),
    },
    examples: { exampleMessages: str(c.sampleChat) },
    media: {},
    attribution: { creator: str(c.creator) },
    discovery: { tags: strList(c.tags) },
  };
}

/** Overlay canonical edits onto an Agnai card (mutates + returns). Only defined values are written. */
function applyBodyToCard(base: AgnaiCard, b: CharacterBody): AgnaiCard {
  const set = <K extends keyof AgnaiCard>(k: K, v: AgnaiCard[K] | undefined): void => {
    if (v !== undefined) base[k] = v;
  };
  set("name", b.identity.name);
  set("description", b.identity.description);
  set("characterVersion", b.identity.characterVersion);
  set("appearance", b.persona.appearance);
  set("scenario", b.persona.scenario);
  set("greeting", b.greetings.firstMessage);
  set("alternateGreetings", b.greetings.alternateGreetings?.map((g) => g.text));
  set("sampleChat", b.examples.exampleMessages);
  set("systemPrompt", b.prompts.systemPrompt);
  set("postHistoryInstructions", b.prompts.postHistoryInstructions);
  set("prefill", b.prompts.prefill);
  set("creator", b.attribution.creator);
  set("tags", b.discovery.tags);
  const depth = b.prompts.depthInjections?.[0];
  if (depth) base.insert = { depth: depth.depth, prompt: depth.text };
  base.persona = toAgnaiPersona(b);
  return base;
}

function baseCard(): AgnaiCard {
  return {
    kind: "character",
    name: "",
    persona: { kind: "text", attributes: { text: [""] } },
    greeting: "",
    scenario: "",
    sampleChat: "",
  };
}

/**
 * Re-embed linked lorebooks into the card's native `characterBook` (a MemoryBook). Only writes when a
 * book is present, never injects an empty one. A single book twin-overlays its own `agnai-lorebook`
 * escrow (byte-identical same-format re-embed); N books merge their entries (convert makes 0/1 today,
 * but this never silently drops the rest) and full-encode.
 */
function applyLorebook(card: AgnaiCard, lorebooks?: CanonicalLorebook[]): void {
  if (!lorebooks || lorebooks.length === 0) return;
  const [first, ...rest] = lorebooks;
  const body: LorebookBody =
    rest.length === 0
      ? first!.body
      : { ...first!.body, entries: lorebooks.flatMap((l) => l.body.entries) };
  // Twin only applies when a single book maps 1:1 to its own raw MemoryBook.
  const twin = rest.length === 0 ? (first!.escrow?.["agnai-lorebook"]?.raw as MemoryBook | undefined) : undefined;
  card.characterBook = canonicalToMemoryBook(body, twin);
}

const adapter: CharacterAdapter = {
  id: "agnai",
  label: "Agnai (Agnaistic) character (.json)",
  outputExtensions: ["json"],
  kind: "character",

  detect(input: AdapterInput): number {
    if (!input.text) return 0;
    try {
      const o = JSON.parse(input.text) as Record<string, unknown>;
      // Agnai's own shape: a character with a structured persona + greeting, and none of our native
      // wrapper (schemaVersion/body) so it never fights vaud-json.
      const isAgnai =
        o?.kind === "character" &&
        typeof o.persona === "object" &&
        o.persona !== null &&
        typeof o.greeting === "string" &&
        o.schemaVersion === undefined &&
        o.body === undefined;
      return isAgnai ? 1 : 0;
    } catch {
      return 0;
    }
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    if (!input.text) throw new Error("agnai: needs text input");
    const card = JSON.parse(input.text) as AgnaiCard;
    if (!card || typeof card.persona !== "object") {
      throw new Error("agnai: not an Agnai character (missing persona)");
    }
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(card.name),
      body: cardToBody(card),
      escrow: { agnai: { raw: card } },
    };
  },

  /** Pull Agnai's native embedded `characterBook` (a MemoryBook) as a linked canonical lorebook. */
  extractLorebook(entity: CanonicalCharacter): CanonicalLorebook | null {
    const raw = entity.escrow?.agnai?.raw as AgnaiCard | undefined;
    const book = coerceMemoryBook(raw?.characterBook);
    return book ? memoryBookToCanonical(book) : null;
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const raw = entity.escrow?.agnai?.raw as AgnaiCard | undefined;
    const card = raw ? structuredClone(raw) : baseCard();
    applyBodyToCard(card, entity.body);
    applyLorebook(card, context?.lorebooks);
    return { text: JSON.stringify(card, null, 2), suggestedExtension: "json" };
  },
};

export { adapter as characterAdapter };
export default [adapter, lorebookCodec];
