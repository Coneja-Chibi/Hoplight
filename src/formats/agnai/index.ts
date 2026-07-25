/**
 * Agnai (Agnaistic) character adapter. Agnai is a JSON format with its own shape, NOT Tavern-lineage:
 * its persona is structured (kind + attributes: boostyle/wpp/sbf/attributes/text), which is exactly
 * the canonical `persona.structured` field. Schema read from Agnai source (common/types/library.ts,
 * common/adapters.ts; AGPL-3.0) as interop facts only - no Agnai code is copied. Lossless: the whole
 * original card rides in original.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import coverage from "./coverage";
import type {
  CanonicalCharacter,
  CharacterBody,
  ImagePrompt,
  MediaAsset,
  Persona,
  Sprite,
  Voice,
} from "../../entities/character/schema";
import type { CanonicalLorebook } from "../../entities/lorebook/schema";
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
  /** Face image (data URI or URL) - maps to media.portrait, not sprite. */
  avatar?: string;
  /** Agnai's native embedded lorebook (a MemoryBook); present in native downloads that have lore. */
  characterBook?: unknown;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const strList = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// -- authored config blocks (voice / sprite / image affixes), shapes verified vs agnai common/types --

/** Agnai `voice` (discriminated on `service`) + `voiceDisabled` -> canonical Voice. */
function readVoice(voice: unknown, voiceDisabled: unknown): Voice | undefined {
  if (!isRec(voice) || typeof voice.service !== "string") return undefined;
  const { service, voiceId, rate, pitch, ...rest } = voice;
  const out: Voice = { provider: service };
  if (typeof voiceId === "string") out.voiceId = voiceId;
  if (num(rate) !== undefined) out.rate = num(rate);
  if (num(pitch) !== undefined) out.pitch = num(pitch);
  if (voiceDisabled === true) out.disabled = true;
  if (Object.keys(rest).length > 0) out.extras = rest;
  return out;
}

/** Canonical Voice -> Agnai wire pair. Returns null when no voice is set (leave the twin alone). */
function voiceToWire(v: Voice | undefined): { voice: Record<string, unknown>; disabled: boolean } | null {
  if (!v) return null;
  const wire: Record<string, unknown> = { service: v.provider, ...(v.extras ?? {}) };
  if (v.voiceId !== undefined) wire.voiceId = v.voiceId;
  if (v.rate !== undefined) wire.rate = v.rate;
  if (v.pitch !== undefined) wire.pitch = v.pitch;
  return { voice: wire, disabled: v.disabled === true };
}

const SPRITE_SPECIALS = ["eyeColor", "bodyColor", "hairColor", "gender"] as const;

/** Agnai FullSprite is FLAT (part keys + colors + gender at one level) -> canonical Sprite {parts, ...}. */
function readSprite(v: unknown): Sprite | undefined {
  if (!isRec(v)) return undefined;
  const parts: Record<string, string> = {};
  const out: Sprite = { parts };
  for (const [k, val] of Object.entries(v)) {
    if ((SPRITE_SPECIALS as readonly string[]).includes(k)) {
      if (typeof val === "string") out[k as (typeof SPRITE_SPECIALS)[number]] = val;
    } else if (typeof val === "string") {
      parts[k] = val;
    }
  }
  return out;
}

const spriteToWire = (s: Sprite): Record<string, unknown> => ({
  ...s.parts,
  ...(s.gender !== undefined ? { gender: s.gender } : {}),
  ...(s.eyeColor !== undefined ? { eyeColor: s.eyeColor } : {}),
  ...(s.bodyColor !== undefined ? { bodyColor: s.bodyColor } : {}),
  ...(s.hairColor !== undefined ? { hairColor: s.hairColor } : {}),
});

/** imageSettings AFFIXES only (authored text); sampler/provider knobs stay on the twin (original). */
function readImagePrompt(v: unknown): ImagePrompt | undefined {
  if (!isRec(v)) return undefined;
  const out: ImagePrompt = {};
  if (typeof v.prefix === "string") out.prefix = v.prefix;
  if (typeof v.suffix === "string") out.suffix = v.suffix;
  if (typeof v.negative === "string") out.negative = v.negative;
  if (typeof v.template === "string") out.template = v.template;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Guess mime from a data URI or a path-ish URL; undefined when unknown. */
function mimeFromRef(ref: string): string | undefined {
  if (ref.startsWith("data:")) {
    const m = /^data:([^;,]+)/.exec(ref);
    return m?.[1];
  }
  const path = ref.split("?")[0] ?? ref;
  const ext = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1).toLowerCase() : "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return undefined;
}

/** Agnai `avatar` string (data URI or URL) -> canonical media.portrait. */
function readAvatar(avatar: unknown): MediaAsset | undefined {
  if (typeof avatar !== "string" || avatar.trim() === "") return undefined;
  const ref = avatar.trim();
  const mime = mimeFromRef(ref);
  const out: MediaAsset = { role: "portrait", ref, primary: true };
  if (mime !== undefined) out.mime = mime;
  return out;
}

/** Canonical portrait -> Agnai avatar string. Absence leaves the twin alone. */
function portraitToAvatar(p: MediaAsset | undefined): string | undefined {
  if (!p || typeof p.ref !== "string" || p.ref.trim() === "") return undefined;
  return p.ref;
}

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
      culture: str(c.culture),
    },
    persona: {
      personality: persona.personality,
      scenario: str(c.scenario),
      appearance: str(c.appearance),
      structured: persona.structured,
      voice: readVoice(c.voice, c.voiceDisabled),
      imagePrompt: readImagePrompt(c.imageSettings),
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
    media: {
      portrait: readAvatar(c.avatar),
      sprite: readSprite(c.sprite),
      visualKind: str(c.visualType),
    },
    attribution: { creator: str(c.creator) },
    discovery: { tags: strList(c.tags) },
    settings: isRec(c.json) ? { responseSchema: c.json } : undefined,
  };
}

/** Overlay canonical edits onto an Agnai card (mutates + returns). Only defined values are written. */
function applyBodyToCard(base: AgnaiCard, b: CharacterBody): AgnaiCard {
  // Write when set; when canonical has cleared a field, delete it from the twin rather than leave the
  // stale value. The character editor clears a text field by dropping the key (writePath treats "" as
  // empty and deletes), so the canonical value goes undefined, not "". Every field routed through set
  // is one the importer reads back via str/strList, so undefined here means "absent", never "unmapped".
  // The string/array guard keeps that honest: only delete what the twin held as a value import could
  // round-trip, so a malformed non-string the importer dropped is preserved, not silently stripped.
  const set = <K extends keyof AgnaiCard>(k: K, v: AgnaiCard[K] | undefined): void => {
    if (v !== undefined) base[k] = v;
    else if (typeof base[k] === "string" || Array.isArray(base[k])) delete base[k];
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
  else if (isRec(base.insert)) delete base.insert;
  base.persona = toAgnaiPersona(b);

  set("culture", b.identity.culture);
  set("visualType", b.media.visualKind);
  // The authored config blocks: same clear contract as the scalars above. Each block's importer maps
  // any twin value of the right shape, so canonical absence is a real clear; the shape guard keeps a
  // malformed twin value (which import skipped) riding as residue instead of being stripped.
  const face = portraitToAvatar(b.media.portrait);
  if (face !== undefined) base.avatar = face;
  else if (typeof base.avatar === "string" && base.avatar.trim() !== "") delete base.avatar;
  if (b.media.sprite) base.sprite = spriteToWire(b.media.sprite);
  else if (isRec(base.sprite)) delete base.sprite;
  const v = voiceToWire(b.persona.voice);
  if (v) {
    base.voice = v.voice;
    if (v.disabled || base.voiceDisabled !== undefined) base.voiceDisabled = v.disabled;
  } else if (isRec(base.voice) && typeof base.voice.service === "string") {
    delete base.voice;
    delete base.voiceDisabled;
  }
  // Affixes reconcile per-key over the twin's imageSettings: authored text is canonical's to write or
  // clear, the sampler/provider knobs are the twin's and survive untouched either way.
  const ip = b.persona.imagePrompt;
  const twinSettings = isRec(base.imageSettings) ? base.imageSettings : undefined;
  if (ip || twinSettings) {
    const merged: Record<string, unknown> = { ...(twinSettings ?? {}) };
    for (const key of ["prefix", "suffix", "negative", "template"] as const) {
      const val = ip?.[key];
      if (val !== undefined) merged[key] = val;
      else if (typeof merged[key] === "string") delete merged[key];
    }
    if (Object.keys(merged).length > 0) base.imageSettings = merged;
    else delete base.imageSettings;
  }
  if (b.settings?.responseSchema) base.json = b.settings.responseSchema;
  else if (isRec(base.json)) delete base.json;
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
 * Re-embed a linked lorebook into the card's native `characterBook` (a MemoryBook). Only writes when a
 * book is present, never injects an empty one. The book twin-overlays its own `agnai-lorebook` original so
 * a same-format re-embed is byte-identical; a foreign book (no twin) full-encodes. `characterBook` is
 * singular, and `convertFile` links 0 or 1, so the first book is the one. A future bundle layer that
 * passes N will need deliberate merge semantics (split boundaries) - it adds them then, not here.
 */
function applyLorebook(card: AgnaiCard, lorebooks?: CanonicalLorebook[]): void {
  if (lorebooks === undefined) return;
  const book = lorebooks?.[0];
  if (!book) {
    delete card.characterBook;
    return;
  }
  const twin = book.original?.["agnai-lorebook"]?.raw as MemoryBook | undefined;
  card.characterBook = canonicalToMemoryBook(book.body, twin);
}

const adapter: CharacterAdapter = {
  id: "agnai",
  label: "Agnai (Agnaistic) character (.json)",
  outputExtensions: ["json"],
  kind: "character",
  coverage,

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
      original: { agnai: { raw: card } },
    };
  },

  /** Pull Agnai's native embedded `characterBook` (a MemoryBook) as a linked canonical lorebook. */
  extractLorebook(entity: CanonicalCharacter): CanonicalLorebook | null {
    const raw = entity.original?.agnai?.raw as AgnaiCard | undefined;
    const book = coerceMemoryBook(raw?.characterBook);
    return book ? memoryBookToCanonical(book) : null;
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const raw = entity.original?.agnai?.raw as AgnaiCard | undefined;
    const card = raw ? structuredClone(raw) : baseCard();
    applyBodyToCard(card, entity.body);
    applyLorebook(card, context?.lorebooks);
    return { text: JSON.stringify(card, null, 2), suggestedExtension: "json" };
  },
};

export { adapter as characterAdapter };
export default [adapter, lorebookCodec];
