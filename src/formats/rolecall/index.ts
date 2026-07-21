/**
 * RoleCall (RC) character-card adapter. RC exports Character Card V3 (png or json) with an
 * `extensions.rolecall` block, a `details` casting-card object, and a sprite/asset model. The
 * standard CCv3 `data` fields go through the shared Tavern mapping; this file adds the RC layer:
 * graded content rating, per-greeting titles, presentation (palette/background/field order/spoilers),
 * RC-native depth injections, source url, and the sprite/expression pack. Field map from RC's own
 * apps/rc source, recorded in design/RC-CARD-FORMAT.md. Lossless: the whole card rides in original, so
 * an RC -> canonical -> RC round-trip reproduces every field, including ones with no canonical home.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput, EmitContext } from "../../core/adapter";
import type {
  CanonicalCharacter,
  CharacterBody,
  ContentRating,
  DepthInjection,
  Greeting,
  Presentation,
} from "../../entities/character/schema";
import coverage from "./coverage";
import lorebookCodec from "./lorebook";
import personaCodec from "./persona";
import { regexAdapter } from "./regex";
import presetCodec from "./preset";
import { embedCharacterBook } from "../_shared/character-book";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readCardJson } from "../_shared/card-io";
import { pngSourceMedia } from "../_shared/png";
import { assetsToMedia, applyMediaToTavernData } from "../_shared/assets";
import { type TavernData, dataToBody, applyBodyToData, CARD_SPEC_V2, CARD_SPEC_V3 } from "../_shared/tavern-fields";

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** RC content_rating <-> canonical rating. Only these three; no boolean-nsfw inference (keeps round-trips exact). */
const RATING_IN: Record<string, ContentRating> = {
  all_hours: "all-ages",
  late_night: "mature",
  after_dark: "explicit",
};
const RATING_OUT: Record<ContentRating, string> = {
  "all-ages": "all_hours",
  mature: "late_night",
  explicit: "after_dark",
};

interface RcDepthInjection {
  id?: string;
  content: string;
  depth?: number;
  role?: "system" | "user" | "assistant";
  enabled?: boolean;
}

interface RcDetails extends Rec {
  // authored identity attributes (casting card)
  full_name?: string;
  title?: string;
  /** free TEXT in RC ("23", "ageless"), never an int */
  age?: string;
  pronouns?: string;
  /** second theming color, distinct from the top-level accent_color */
  signature_color?: string;
  /** creator-supplied external reference links */
  media_links?: string[];
  gradient_colors?: string[];
  colors?: Array<{ label?: string; name?: string; hex: string }>;
  fieldOrder?: string[];
  default_background?: {
    backgroundId?: string | null;
    customUrl?: string | null;
    overlayOpacity?: number;
    videoPlaybackRate?: number;
  };
  prompt_depth_injections?: RcDepthInjection[];
  publicDefinitionDisplay?: { spoilerMode?: boolean; order?: string[]; spoilers?: Record<string, boolean> };
}

interface RcExtension extends Rec {
  /** "persona" on RC's persona-export cards - a DIFFERENT entity kind, handled by rolecall-persona */
  type?: string;
  tagline?: string;
  genre?: string;
  fandom?: string;
  content_rating?: string;
  source_url?: string;
  accent_color?: string;
  /** public "from the creator" note on the card page; DISTINCT from data.creator_notes */
  creators_note?: string;
  details?: RcDetails;
  alternate_greeting_titles?: Array<string | null>;
}

const rolecallExt = (data: TavernData): RcExtension | undefined => {
  const ext = data.extensions;
  return isRecord(ext) && isRecord(ext.rolecall) ? (ext.rolecall as RcExtension) : undefined;
};

/** data.alternate_greetings (texts) + rolecall.alternate_greeting_titles (parallel) -> Greeting[]. */
function titledGreetings(data: TavernData, rc: RcExtension): Greeting[] | undefined {
  const texts = Array.isArray(data.alternate_greetings) ? data.alternate_greetings : undefined;
  if (!texts) return undefined;
  const titles = rc.alternate_greeting_titles;
  return texts
    .filter((t): t is string => typeof t === "string")
    .map((text, i) => {
      const title = titles?.[i];
      return title ? { text, title } : { text };
    });
}

/** rolecall.details.prompt_depth_injections -> canonical depth injections (RC defaults: depth 4, role system). */
function depthInjections(rc: RcExtension): DepthInjection[] | undefined {
  const list = rc.details?.prompt_depth_injections;
  if (!Array.isArray(list)) return undefined;
  return list.map((pi) => ({
    text: pi.content,
    depth: pi.depth ?? 4,
    role: pi.role ?? "system",
    enabled: pi.enabled,
    origin: "rolecall_details" as const,
  }));
}

/** rolecall details -> the casting-card presentation layer (undefined when empty). accent_color is
 * account-level, not a card field, so it is not surfaced here; it still rides in the kept-whole
 * original and re-emits unchanged on export. */
function presentation(rc: RcExtension): Presentation | undefined {
  const d = rc.details;
  const bg = d?.default_background;
  const bgRef = bg ? (bg.customUrl ?? bg.backgroundId ?? undefined) : undefined;
  const p: Presentation = {
    signatureColor: d?.signature_color,
    gradientColors: d?.gradient_colors,
    palette: d?.colors?.map((c) => ({ label: c.label, name: c.name, hex: c.hex })),
    background: bgRef
      ? { ref: bgRef, overlayOpacity: bg?.overlayOpacity, videoPlaybackRate: bg?.videoPlaybackRate }
      : undefined,
    fieldOrder: d?.fieldOrder,
    // fields is the authored per-field spoiler boolean map - previously collapsed to mode/order and LOST
    spoilers: d?.publicDefinitionDisplay
      ? {
          mode: d.publicDefinitionDisplay.spoilerMode ? "on" : "off",
          order: d.publicDefinitionDisplay.order,
          fields: d.publicDefinitionDisplay.spoilers,
        }
      : undefined,
    mediaLinks: d?.media_links,
  };
  return Object.values(p).some((v) => v !== undefined) ? p : undefined;
}

/** Overlay the RC-specific layer onto the shared-mapped body. */
function cardToBody(data: TavernData, rc: RcExtension): CharacterBody {
  const body = dataToBody(data);
  body.identity.tagline = rc.tagline ?? body.identity.tagline;
  body.discovery.genre = rc.genre;
  body.discovery.fandom = rc.fandom;
  body.discovery.rating = rc.content_rating ? RATING_IN[rc.content_rating] : undefined;
  body.attribution.sourceUrl = rc.source_url;
  body.attribution.publicNote = rc.creators_note;

  // authored casting-card identity attributes (details.*) -> Identity slots
  const d = rc.details;
  body.identity.fullName = typeof d?.full_name === "string" ? d.full_name : undefined;
  body.identity.title = typeof d?.title === "string" ? d.title : undefined;
  body.identity.age = typeof d?.age === "string" ? d.age : undefined;
  body.identity.pronouns = typeof d?.pronouns === "string" ? d.pronouns : undefined;

  const titled = titledGreetings(data, rc);
  if (titled) body.greetings.alternateGreetings = titled;

  // CONCAT, never replace: dataToBody already read the depth_prompt-origin injection from the shared
  // extensions path; RC's details injections join it (details first). A replace here clobbered the
  // depth_prompt entry whenever both were present - each origin re-emits to its own home on export.
  const depths = depthInjections(rc);
  if (depths) body.prompts.depthInjections = [...depths, ...(body.prompts.depthInjections ?? [])];

  const pres = presentation(rc);
  if (pres) body.presentation = pres;

  const media = assetsToMedia(data.assets);
  if (media.portrait || media.assets) body.media = media;

  return body;
}

/** Structural equality for presentation overlay decisions. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => same(v, b[i]));
  }
  if (typeof a === "object") {
    const ao = a as Rec;
    const bo = b as Rec;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) if (!same(ao[k], bo[k])) return false;
    return true;
  }
  return false;
};

/** URL/data refs go to customUrl; anything else is an opaque RoleCall backgroundId. */
const isUrlOrDataRef = (ref: string): boolean =>
  /^(https?:|data:|blob:|file:)/i.test(ref) || ref.startsWith("//");

/**
 * Write the canonically-editable scalars back onto a cloned raw RC extension block. Only the exact
 * 1:1 mappings are re-applied so an untouched card round-trips byte-identical. Presentation fields
 * the reader promotes (gradient/palette/background/fieldOrder) get a matching inverse write with
 * Plan 009 three-state clear semantics.
 */
function applyBodyToRcExt(ext: RcExtension, body: CharacterBody): void {
  const set = <K extends keyof RcExtension>(k: K, v: RcExtension[K] | undefined): void => {
    if (v !== undefined) ext[k] = v;
  };
  set("tagline", body.identity.tagline);
  set("genre", body.discovery.genre);
  set("fandom", body.discovery.fandom);
  if (body.discovery.rating) ext.content_rating = RATING_OUT[body.discovery.rating];
  set("source_url", body.attribution.sourceUrl);
  set("creators_note", body.attribution.publicNote);

  const titles = body.greetings.alternateGreetings?.map((g) => g.title ?? null);
  if (titles?.some((t) => t !== null)) ext.alternate_greeting_titles = titles;

  const id = body.identity;
  const pres = body.presentation;
  // Decode twin presentation BEFORE mutating details so clear-vs-untouched is accurate.
  const twinPres = presentation(ext);

  const wantsDetails =
    id.fullName !== undefined ||
    id.title !== undefined ||
    id.age !== undefined ||
    id.pronouns !== undefined ||
    pres?.signatureColor !== undefined ||
    pres?.mediaLinks !== undefined ||
    pres?.spoilers !== undefined ||
    pres?.gradientColors !== undefined ||
    pres?.palette !== undefined ||
    pres?.background !== undefined ||
    pres?.fieldOrder !== undefined ||
    // clear path: twin had a representable value the body no longer carries
    (twinPres?.gradientColors !== undefined && pres?.gradientColors === undefined) ||
    (twinPres?.palette !== undefined && pres?.palette === undefined) ||
    (twinPres?.background !== undefined && pres?.background === undefined) ||
    (twinPres?.fieldOrder !== undefined && pres?.fieldOrder === undefined);
  if (!wantsDetails) return;

  const details = (isRecord(ext.details) ? ext.details : (ext.details = {})) as RcDetails;
  const setD = <K extends keyof RcDetails>(k: K, v: RcDetails[K] | undefined): void => {
    if (v !== undefined) details[k] = v;
  };
  setD("full_name", id.fullName);
  setD("title", id.title);
  setD("age", id.age);
  setD("pronouns", id.pronouns);
  setD("signature_color", pres?.signatureColor);
  setD("media_links", pres?.mediaLinks);
  if (pres?.spoilers) {
    const pdd = (isRecord(details.publicDefinitionDisplay)
      ? details.publicDefinitionDisplay
      : (details.publicDefinitionDisplay = {})) as NonNullable<RcDetails["publicDefinitionDisplay"]>;
    if (pres.spoilers.mode !== undefined) pdd.spoilerMode = pres.spoilers.mode === "on";
    if (pres.spoilers.order !== undefined) pdd.order = pres.spoilers.order;
    if (pres.spoilers.fields !== undefined) pdd.spoilers = pres.spoilers.fields;
  }

  // --- gradient_colors ---
  if (pres?.gradientColors !== undefined) {
    if (!same(pres.gradientColors, twinPres?.gradientColors)) details.gradient_colors = pres.gradientColors;
  } else if (twinPres?.gradientColors !== undefined) {
    delete details.gradient_colors;
  }

  // --- colors (palette): overlay known label/name/hex; keep unknown row siblings when matched ---
  if (pres?.palette !== undefined) {
    if (!same(pres.palette, twinPres?.palette)) {
      const prev = Array.isArray(details.colors) ? details.colors : [];
      details.colors = pres.palette.map((sw, i) => {
        const match =
          prev.find(
            (p) =>
              (sw.name !== undefined && p.name === sw.name) ||
              (sw.label !== undefined && p.label === sw.label) ||
              p.hex === sw.hex,
          ) ?? prev[i];
        if (match && isRecord(match)) {
          const next: Rec = { ...match, hex: sw.hex };
          if (sw.label !== undefined) next.label = sw.label;
          if (sw.name !== undefined) next.name = sw.name;
          return next as { label?: string; name?: string; hex: string };
        }
        return { ...(sw.label !== undefined ? { label: sw.label } : {}), ...(sw.name !== undefined ? { name: sw.name } : {}), hex: sw.hex };
      });
    }
  } else if (twinPres?.palette !== undefined) {
    delete details.colors;
  }

  // --- fieldOrder ---
  if (pres?.fieldOrder !== undefined) {
    if (!same(pres.fieldOrder, twinPres?.fieldOrder)) details.fieldOrder = pres.fieldOrder;
  } else if (twinPres?.fieldOrder !== undefined) {
    delete details.fieldOrder;
  }

  // --- default_background: preserve customUrl vs backgroundId home; overlay opacity/rate ---
  if (pres?.background !== undefined) {
    if (!same(pres.background, twinPres?.background)) {
      const prev = isRecord(details.default_background) ? { ...details.default_background } : {};
      const ref = pres.background.ref;
      const hadCustom = typeof prev.customUrl === "string" && prev.customUrl !== "";
      const hadId = typeof prev.backgroundId === "string" && prev.backgroundId !== "";
      if (hadCustom) {
        prev.customUrl = ref;
      } else if (hadId) {
        prev.backgroundId = ref;
      } else if (isUrlOrDataRef(ref)) {
        prev.customUrl = ref;
        if (prev.backgroundId === undefined) prev.backgroundId = null;
      } else {
        prev.backgroundId = ref;
        if (prev.customUrl === undefined) prev.customUrl = null;
      }
      if (pres.background.overlayOpacity !== undefined) prev.overlayOpacity = pres.background.overlayOpacity;
      if (pres.background.videoPlaybackRate !== undefined) prev.videoPlaybackRate = pres.background.videoPlaybackRate;
      details.default_background = prev as NonNullable<RcDetails["default_background"]>;
    }
  } else if (twinPres?.background !== undefined) {
    delete details.default_background;
  }
}

const adapter: CharacterAdapter = {
  id: "rolecall",
  label: "RoleCall character card (v3, png/json)",
  outputExtensions: ["json"],
  kind: "character",
  coverage,

  // 1.0: an RC card is a CCv3 card PLUS an extensions.rolecall block, so it outranks the generic
  // SillyTavern reader (0.9) and gets to map its own layer. CROSS-KIND FIREWALL: RC's persona export
  // route emits this same V2 shape with rolecall.type === "persona" - that is a PERSONA, claimed by
  // the rolecall-persona codec; the character adapter must step aside or the two tie at 1.0.
  detect(input: AdapterInput): number {
    const json = readCardJson(input);
    if (!isRecord(json)) return 0;
    const spec = json.spec;
    if (spec !== CARD_SPEC_V3 && spec !== CARD_SPEC_V2) return 0;
    if (!isRecord(json.data)) return 0;
    const rc = rolecallExt(json.data as TavernData);
    return rc && rc.type !== "persona" ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    const json = readCardJson(input);
    if (!isRecord(json) || !isRecord(json.data)) {
      throw new Error("rolecall: not a RoleCall card (no data object)");
    }
    const data = json.data as TavernData;
    const rc = rolecallExt(data);
    if (!rc) throw new Error("rolecall: card has no extensions.rolecall block");
    if (rc.type === "persona") throw new Error("rolecall: this is an RC PERSONA export (use rolecall-persona)");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: canonicalId(data.name),
      body: cardToBody(data, rc),
      // a PNG card's pixels are authored art: keep the carrier as the raw-bytes twin
      original: { rolecall: { raw: json, sourceMedia: pngSourceMedia(input.bytes) } },
    };
  },

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const raw = entity.original?.rolecall?.raw;
    const card: Rec = isRecord(raw)
      ? (structuredClone(raw) as Rec)
      : { spec: CARD_SPEC_V3, spec_version: "3.0", data: {} };

    if (!isRecord(card.data)) card.data = {};
    const data = card.data as TavernData;
    applyBodyToData(data, entity.body);
    applyMediaToTavernData(data, entity.body.media, "rolecall");

    if (!isRecord(data.extensions)) data.extensions = {};
    const ext = data.extensions as Rec;
    if (!isRecord(ext.rolecall)) ext.rolecall = {};
    applyBodyToRcExt(ext.rolecall as RcExtension, entity.body);

    // Re-embed any referenced lorebook into the CCv3 character_book slot (RC reads it on import).
    if (context?.lorebooks?.length) embedCharacterBook(data as Rec, context.lorebooks);

    return { text: JSON.stringify(card, null, 2), suggestedExtension: "json" };
  },
};

/** The RoleCall family's character codec, exported by name for direct importers. */
export { adapter as characterAdapter };

/** Folders-as-schema: this format family exports every codec it provides (character + lorebook +
 * persona + regex scripts + preset exports). */
export default [adapter, lorebookCodec, personaCodec, regexAdapter, presetCodec];
