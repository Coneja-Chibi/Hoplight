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

/** Structural equality for decoded twin vs canonical values (no functions in this shape). */
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => same(v, b[i]));
  }
  if (typeof a === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) if (!same(ao[k], bo[k])) return false;
    return true;
  }
  return false;
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
 *
 * Three-state vs the twin's decoded representable values (dataToBody):
 * 1. canonical equals decoded twin: leave raw bytes/shape untouched;
 * 2. canonical has a defined changed value: write it;
 * 3. twin had a representable value and canonical is now absent: clear its exact wire home.
 *
 * When BOTH decoded twin and canonical are absent, raw is left alone. That protects values the
 * reader deliberately cannot represent (e.g. RoleCall object-form `source`) and unknown keys.
 */
export function applyBodyToData(base: TavernData, b: CharacterBody): TavernData {
  const twin = dataToBody(base);

  /** Text slot: clear with "". Both-absent leaves raw. */
  const setText = (
    key: keyof TavernData,
    canon: string | undefined,
    twinVal: string | undefined,
  ): void => {
    if (canon === undefined) {
      if (twinVal !== undefined) (base as Record<string, unknown>)[key as string] = "";
      return;
    }
    if (canon !== twinVal) (base as Record<string, unknown>)[key as string] = canon;
  };

  /** List/greeting/tag slot: clear with []. Both-absent leaves raw. */
  const setList = (
    key: keyof TavernData,
    canon: unknown[] | undefined,
    twinVal: unknown[] | undefined,
  ): void => {
    if (canon === undefined) {
      if (twinVal !== undefined) (base as Record<string, unknown>)[key as string] = [];
      return;
    }
    if (!same(canon, twinVal)) (base as Record<string, unknown>)[key as string] = canon;
  };

  /** Optional numeric/date: clear by key deletion. */
  const setOptNum = (
    key: keyof TavernData,
    canon: number | undefined,
    twinVal: number | undefined,
  ): void => {
    if (canon === undefined) {
      if (twinVal !== undefined) delete (base as Record<string, unknown>)[key as string];
      return;
    }
    if (canon !== twinVal) (base as Record<string, unknown>)[key as string] = canon;
  };

  /** Optional object: clear by key deletion. */
  const setOptObj = (key: keyof TavernData, canon: unknown, twinVal: unknown): void => {
    if (canon === undefined) {
      if (twinVal !== undefined) delete (base as Record<string, unknown>)[key as string];
      return;
    }
    if (!same(canon, twinVal)) (base as Record<string, unknown>)[key as string] = canon;
  };

  // name is always a string on the body (required); write only when it actually changed
  if (b.identity.name !== twin.identity.name) base.name = b.identity.name;

  setText("nickname", b.identity.nickname, twin.identity.nickname);
  setText("description", b.identity.description, twin.identity.description);
  setText("personality", b.persona.personality, twin.persona.personality);
  setText("scenario", b.persona.scenario, twin.persona.scenario);
  setText("first_mes", b.greetings.firstMessage, twin.greetings.firstMessage);
  setText("mes_example", b.examples.exampleMessages, twin.examples.exampleMessages);
  setText("system_prompt", b.prompts.systemPrompt, twin.prompts.systemPrompt);
  setText(
    "post_history_instructions",
    b.prompts.postHistoryInstructions,
    twin.prompts.postHistoryInstructions,
  );
  setText("creator_notes", b.attribution.creatorNotes, twin.attribution.creatorNotes);
  setText("creator", b.attribution.creator, twin.attribution.creator);
  setText("character_version", b.identity.characterVersion, twin.identity.characterVersion);

  setOptObj(
    "creator_notes_multilingual",
    b.attribution.creatorNotesMultilingual,
    twin.attribution.creatorNotesMultilingual,
  );

  // source: only act when the reader could represent it as string[]. Object-form RoleCall sources
  // decode to undefined; clearing would destroy that non-representable raw if we wrote [] blindly.
  const canonSrc = b.attribution.source?.length ? b.attribution.source : undefined;
  const twinSrc = twin.attribution.source?.length ? twin.attribution.source : undefined;
  if (canonSrc === undefined) {
    if (twinSrc !== undefined) base.source = [];
  } else if (!same(canonSrc, twinSrc)) {
    base.source = canonSrc;
  }

  setOptNum("creation_date", b.attribution.createdAt, twin.attribution.createdAt);
  setOptNum("modification_date", b.attribution.updatedAt, twin.attribution.updatedAt);

  setList(
    "group_only_greetings",
    fromGreetings(b.greetings.groupOnlyGreetings),
    fromGreetings(twin.greetings.groupOnlyGreetings),
  );
  setList("tags", b.discovery.tags, twin.discovery.tags);
  setList(
    "alternate_greetings",
    fromGreetings(b.greetings.alternateGreetings),
    fromGreetings(twin.greetings.alternateGreetings),
  );

  // First-class extension keys: write when changed; delete the exact key on clear; keep siblings.
  const twinExt = base.extensions as Record<string, unknown> | undefined;
  const writeExt = (k: string, v: unknown): void => {
    base.extensions = { ...(base.extensions ?? {}), [k]: v };
  };
  const deleteExt = (k: string): void => {
    if (twinExt === undefined || !(k in twinExt)) return;
    const next = { ...(base.extensions ?? {}) };
    delete next[k];
    base.extensions = next;
  };

  const talk = b.settings?.talkativeness;
  const twinTalk = twin.settings?.talkativeness;
  if (talk === undefined) {
    if (twinTalk !== undefined) deleteExt("talkativeness");
  } else if (numParse(twinExt?.talkativeness) !== talk) {
    writeExt("talkativeness", talk);
  }

  if (b.worldName === undefined) {
    if (twin.worldName !== undefined) deleteExt("world");
  } else if (twinExt?.world !== b.worldName) {
    writeExt("world", b.worldName);
  }

  const inj = b.prompts.depthInjections?.find((x) => x.origin === "depth_prompt");
  const twinInj = twin.prompts.depthInjections?.find((x) => x.origin === "depth_prompt");
  if (!inj) {
    // Only delete when the twin actually had a representable authored injection. An empty ST
    // default {prompt:"",depth,role} is not representable as an injection - leave it alone.
    if (twinInj) deleteExt("depth_prompt");
  } else {
    const cur = twinExt?.depth_prompt as Record<string, unknown> | undefined;
    if (!cur || cur.prompt !== inj.text || cur.depth !== inj.depth || cur.role !== inj.role) {
      const next = { prompt: inj.text, depth: inj.depth, ...(inj.role ? { role: inj.role } : {}) };
      writeExt("depth_prompt", { ...(cur ?? {}), ...next });
    }
  }
  return base;
}
