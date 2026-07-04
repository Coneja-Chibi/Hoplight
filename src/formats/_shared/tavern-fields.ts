/**
 * Shared Tavern-card field mapping (V2/V3 `data` <-> canonical CharacterBody).
 * Used by every Tavern-lineage format: SillyTavern (png/json) and Risu (.charx card.json)
 * both carry this exact `data` shape, so the mapping lives here once.
 * The `_shared` folder starts with "_", so the format loader skips it (it is not a format).
 */
import type { CharacterBody, Greeting } from "../../entities/character/schema";

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

/** V2/V3 `data` -> canonical CharacterBody. */
export function dataToBody(d: TavernData): CharacterBody {
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
  };
}

/**
 * Overlay canonical edits onto a `data` object (mutates + returns it).
 * Only defined values are written, so a `data` built from escrow keeps every
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
  set("source", b.attribution.source);
  set("creation_date", b.attribution.createdAt);
  set("modification_date", b.attribution.updatedAt);
  set("group_only_greetings", fromGreetings(b.greetings.groupOnlyGreetings));
  set("tags", b.discovery.tags);
  set("creator", b.attribution.creator);
  set("character_version", b.identity.characterVersion);
  set("alternate_greetings", fromGreetings(b.greetings.alternateGreetings));
  return base;
}
