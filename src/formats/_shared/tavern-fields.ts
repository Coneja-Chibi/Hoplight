/**
 * Shared Tavern-card field mapping (V2/V3 `data` <-> canonical CharacterBody).
 * Used by every Tavern-lineage format: SillyTavern (png/json) and Risu (.charx card.json)
 * both carry this exact `data` shape, so the mapping lives here once.
 * The `_shared` folder starts with "_", so the format loader skips it (it is not a format).
 */
import type { CharacterBody, DepthInjection, Greeting } from "../../entities/character/schema";

export interface TavernData extends Record<string, unknown> {
  name?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  creator_notes?: string;
  tags?: string[];
  creator?: string;
  character_version?: string;
  alternate_greetings?: string[];
  extensions?: Record<string, unknown>;
  character_book?: unknown;
  // V3 additions
  nickname?: string;
  source?: string[];
  creation_date?: number;
  modification_date?: number;
  creator_notes_multilingual?: Record<string, string>;
  group_only_greetings?: string[];
  assets?: unknown;
}

/**
 * The CCv2/CCv3 card ENVELOPE (spec magic strings + spec_version + `data` wrapper) is one format
 * decision, owned here so every Tavern-lineage adapter (SillyTavern, Risu) wraps/unwraps it the
 * same way instead of hardcoding the strings twice.
 */
export const CARD_SPEC_V2 = "chara_card_v2";
export const CARD_SPEC_V3 = "chara_card_v3";

interface CardEnvelope {
  spec: string;
  spec_version: string;
  data: TavernData;
}

export const wrapV2 = (data: TavernData): CardEnvelope => ({ spec: CARD_SPEC_V2, spec_version: "2.0", data });
export const wrapV3 = (data: TavernData): CardEnvelope => ({ spec: CARD_SPEC_V3, spec_version: "3.0", data });

const toStrings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((g): g is string => typeof g === "string") : undefined;

/** Tavern greetings are bare strings; the canonical model carries an optional title Tavern never sets. */
const toGreetings = (v: unknown): Greeting[] | undefined => toStrings(v)?.map((text) => ({ text }));
const fromGreetings = (g: Greeting[] | undefined): string[] | undefined => g?.map((x) => x.text);

/** Tolerant number read: ST stores `talkativeness` as a string ("0.5") on some cards, a number on others. */
const numParse = (v: unknown): number | undefined => {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const isRole = (v: unknown): v is "system" | "user" | "assistant" =>
  v === "system" || v === "user" || v === "assistant";

/**
 * `extensions.depth_prompt` -> a depth-injection with `origin:"depth_prompt"` so it re-emits home on
 * export. An empty prompt string means "no note authored" (ST writes a default {prompt:"",depth,role}
 * even when unset), so we return none and let the depth/role config ride the original twin untouched.
 */
const readDepthPrompt = (ext: Record<string, unknown>): DepthInjection[] | undefined => {
  const dp = ext.depth_prompt;
  if (!dp || typeof dp !== "object") return undefined;
  const o = dp as Record<string, unknown>;
  const text = typeof o.prompt === "string" ? o.prompt : "";
  if (text.trim() === "") return undefined;
  const depth = typeof o.depth === "number" ? o.depth : 4;
  // Carry role only when the card authored one; absence means ST's default ("system"), applied at
  // consumption, not stored - so an unauthored role does not get fabricated back on export.
  return [{ text, depth, ...(isRole(o.role) ? { role: o.role } : {}), origin: "depth_prompt" }];
};

/** V2/V3 `data` -> canonical CharacterBody. */
export function dataToBody(d: TavernData): CharacterBody {
  const ext = (d.extensions ?? {}) as Record<string, unknown>;
  const talkativeness = numParse(ext.talkativeness);
  const world = typeof ext.world === "string" && ext.world !== "" ? ext.world : undefined;
  return {
    identity: {
      name: typeof d.name === "string" ? d.name : "",
      nickname: d.nickname,
      description: d.description,
      characterVersion: d.character_version,
    },
    persona: { personality: d.personality, scenario: d.scenario },
    prompts: {
      systemPrompt: d.system_prompt,
      postHistoryInstructions: d.post_history_instructions,
      depthInjections: readDepthPrompt(ext),
    },
    greetings: {
      firstMessage: d.first_mes,
      alternateGreetings: toGreetings(d.alternate_greetings),
      groupOnlyGreetings: toGreetings(d.group_only_greetings),
    },
    examples: { exampleMessages: d.mes_example },
    media: {},
    attribution: {
      creator: d.creator,
      creatorNotes: d.creator_notes,
      source: toStrings(d.source),
      creatorNotesMultilingual: d.creator_notes_multilingual,
      createdAt: typeof d.creation_date === "number" ? d.creation_date : undefined,
      updatedAt: typeof d.modification_date === "number" ? d.modification_date : undefined,
    },
    discovery: { tags: Array.isArray(d.tags) ? d.tags : undefined },
    settings: talkativeness !== undefined ? { talkativeness } : undefined,
    worldName: world,
  };
}

/**
 * Overlay canonical edits onto a `data` object (mutates + returns it).
 * Only defined values are written, so a `data` built from original keeps every
 * unmapped field (extensions, character_book, assets, ...) untouched -> lossless.
 */
export function applyBodyToData(base: TavernData, b: CharacterBody): TavernData {
  const set = <K extends keyof TavernData>(k: K, v: TavernData[K] | undefined): void => {
    if (v !== undefined) base[k] = v;
  };
  set("name", b.identity.name);
  set("nickname", b.identity.nickname);
  set("description", b.identity.description);
  set("personality", b.persona.personality);
  set("scenario", b.persona.scenario);
  set("first_mes", b.greetings.firstMessage);
  set("mes_example", b.examples.exampleMessages);
  set("system_prompt", b.prompts.systemPrompt);
  set("post_history_instructions", b.prompts.postHistoryInstructions);
  set("creator_notes", b.attribution.creatorNotes);
  set("creator_notes_multilingual", b.attribution.creatorNotesMultilingual);
  // Empty source = nothing decoded, not "clear the field": RoleCall emits nonstandard source OBJECTS
  // ([{name}]) that toStrings cannot decode, so writing the empty result back would destroy the twin's
  // value. The provenance is already first-class on attribution.creator; the object form rides the twin.
  set("source", b.attribution.source?.length ? b.attribution.source : undefined);
  set("creation_date", b.attribution.createdAt);
  set("modification_date", b.attribution.updatedAt);
  set("group_only_greetings", fromGreetings(b.greetings.groupOnlyGreetings));
  set("tags", b.discovery.tags);
  set("creator", b.attribution.creator);
  set("character_version", b.identity.characterVersion);
  set("alternate_greetings", fromGreetings(b.greetings.alternateGreetings));

  // Authored `extensions` fields pulled out to real canonical slots re-emit into extensions. Overlay onto
  // the twin only when the canonical value DIFFERS from what the twin already carries: an unedited field
  // stays byte-identical, an edited one wins. Skipping the write would silently drop the user's edit while
  // the round-trip test still passed - the exact trap this guards against.
  const twinExt = base.extensions as Record<string, unknown> | undefined;
  const writeExt = (k: string, v: unknown): void => {
    base.extensions = { ...(base.extensions ?? {}), [k]: v };
  };

  const talk = b.settings?.talkativeness;
  if (talk !== undefined && numParse(twinExt?.talkativeness) !== talk) writeExt("talkativeness", talk);

  if (b.worldName !== undefined && twinExt?.world !== b.worldName) writeExt("world", b.worldName);

  const inj = b.prompts.depthInjections?.find((x) => x.origin === "depth_prompt");
  if (inj) {
    const cur = twinExt?.depth_prompt as Record<string, unknown> | undefined;
    if (!cur || cur.prompt !== inj.text || cur.depth !== inj.depth || cur.role !== inj.role) {
      const next = { prompt: inj.text, depth: inj.depth, ...(inj.role ? { role: inj.role } : {}) };
      writeExt("depth_prompt", { ...(cur ?? {}), ...next });
    }
  }
  return base;
}
