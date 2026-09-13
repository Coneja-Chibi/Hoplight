/**
 * SillyTavern completion-preset wire layer, parse side (specs/formats/st-preset.md; RoleCall's
 * preset export writes this same flat grammar). Pure: raw JSON in, canonical PresetBody pieces out.
 * The Round-Trip Law shape: real prompts land in body.prompts, divider rows become canonical
 * groups whose id IS the original divider identifier (so serialize replays it, never re-mints),
 * everything else rides on the raw twin in entity.original. The emit half lives in preset-emit.ts.
 */
import type {
  PresetApiOptions,
  PresetBehavior,
  PresetBody,
  PresetGeneration,
  PresetGroup,
  PresetMedia,
  PresetPrompt,
  PresetSamplers,
  PresetSystemPrompts,
  PresetTemplates,
  PromptPlacement,
  PromptRole,
} from "../../entities/preset/schema";
import {
  apiSchema,
  behaviorSchema,
  generationSchema,
  mediaSchema,
  samplerSchema,
  systemPromptSchema,
  templateSchema,
} from "../../entities/preset/runtime-schema";

export type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** The twelve built-in ST prompt identifiers (isDefault detection). */
export const DEFAULT_PROMPT_IDENTIFIERS = new Set([
  "main", "jailbreak", "nsfw", "dialogueExamples", "chatHistory", "worldInfoAfter",
  "worldInfoBefore", "enhanceDefinitions", "charDescription", "charPersonality", "scenario",
  "personaDescription",
]);

/** The FIVE true structural markers (the 5-vs-12 distinction; the rest carry real content). */
export const DEFAULT_MARKER_IDENTIFIERS = new Set([
  "chatHistory", "worldInfoBefore", "worldInfoAfter", "dialogueExamples", "personaDescription",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ST numeric injection_position <-> canonical placement (unknown numbers ride in extras). */
const PLACEMENT_BY_POSITION: Record<number, PromptPlacement> = {
  0: "relative", 1: "in_chat", 2: "append", 3: "append_preset", 4: "prepend_preset",
};
export const POSITION_BY_PLACEMENT: Record<string, number> = {
  relative: 0, in_chat: 1, append: 2, append_preset: 3, prepend_preset: 4,
};

/** [wireKey, canonicalKey] tables per settings group; parse maps present fields only (absent
 * stays absent, the Round-Trip Law forbids inventing values the source never had). */
export const SAMPLER_FIELDS = [
  ["temperature", "temperature"], ["frequency_penalty", "frequencyPenalty"],
  ["presence_penalty", "presencePenalty"], ["top_p", "topP"], ["top_k", "topK"],
  ["top_a", "topA"], ["min_p", "minP"], ["repetition_penalty", "repetitionPenalty"],
  ["openai_max_context", "maxContext"], ["openai_max_tokens", "maxTokens"],
  // SillyTavern's key is `custom_prompt_post_processing` (openai.js settingsToUpdate). Reading
  // `prompt_post_processing` matched nothing ST has ever written, so this setting was silently
  // dropped on every import. The emit half shares this table, so both directions move together.
  ["custom_prompt_post_processing", "promptPostProcessing"],
] as const;
export const SYSTEM_PROMPT_FIELDS = [
  ["impersonation_prompt", "impersonation"], ["new_chat_prompt", "newChat"],
  ["new_group_chat_prompt", "newGroupChat"], ["new_example_chat_prompt", "newExampleChat"],
  ["continue_nudge_prompt", "continueNudge"], ["group_nudge_prompt", "groupNudge"],
  ["assistant_prefill", "assistantPrefill"], ["assistant_impersonation", "assistantImpersonation"],
] as const;
export const TEMPLATE_FIELDS = [
  ["wi_format", "worldInfoFormat"], ["scenario_format", "scenarioFormat"],
  ["personality_format", "personalityFormat"],
] as const;
export const BEHAVIOR_FIELDS = [
  ["wrap_in_quotes", "wrapInQuotes"], ["names_behavior", "namesBehavior"],
  ["send_if_empty", "sendIfEmpty"], ["continue_prefill", "continuePrefill"],
  ["continue_postfix", "continuePostfix"],
] as const;
export const API_OPTION_FIELDS = [
  ["stream_openai", "streamResponses"], ["claude_use_sysprompt", "claudeUseSystemPrompt"],
  ["use_makersuite_sysprompt", "useMakerSuiteSystemPrompt"],
  ["squash_system_messages", "squashSystemMessages"], ["function_calling", "functionCalling"],
  ["show_thoughts", "showThoughts"], ["reasoning_effort", "reasoningEffort"],
  ["enable_web_search", "enableWebSearch"], ["request_images", "requestImages"],
] as const;
export const MEDIA_FIELDS = [
  ["image_inlining", "imageInlining"], ["inline_image_quality", "inlineImageQuality"],
  ["video_inlining", "videoInlining"],
] as const;
export const GENERATION_FIELDS = [
  ["seed", "seed"], ["n", "completions"], ["max_context_unlocked", "maxContextUnlocked"],
  ["bias_preset_selected", "biasPreset"],
] as const;

/**
 * The primitive each canonical settings key expects, READ OFF THE SCHEMA rather than restated here.
 *
 * Hand-annotating the field tables with types would create a second source of truth that drifts
 * from the decoder, which is the precise failure `defineExhaustiveShape` exists to prevent. The
 * schema already knows; ask it.
 */
type Primitive = "string" | "number" | "boolean";

const expectedTypes = (schema: unknown): Map<string, Primitive> => {
  const shape = (schema as { def?: { shape?: Record<string, unknown> } }).def?.shape ?? {};
  const out = new Map<string, Primitive>();
  for (const [key, field] of Object.entries(shape)) {
    let node = field as { def?: { type?: string; innerType?: unknown } };
    while (node?.def?.innerType) node = node.def.innerType as typeof node;
    const type = node?.def?.type;
    if (type === "string" || type === "number" || type === "boolean") out.set(key, type);
  }
  return out;
};

/**
 * Bring one wire value to the type the canonical field declares, or leave it alone.
 *
 * WHY THIS EXISTS. SillyTavern stores preset values verbatim and re-exports them verbatim, so a
 * setting that ever became a string stays a string forever - and every real preset carrying
 * `"temperature": "1.0"` was rejected outright as a corrupt file. Converting at the boundary is the
 * project's own rule (parse untrusted input once, into a known type); the decoder had been
 * validating without ever parsing.
 *
 * CONVERSIONS ARE LOSSLESS OR REFUSED. An empty string is NOT zero and "yes" is NOT true: anything
 * ambiguous passes through untouched so the decoder still reports it, rather than being guessed
 * into a value the author never wrote.
 */
function coerce(value: unknown, want: Primitive | undefined): unknown {
  if (want === undefined || typeof value === want) return value;
  if (want === "number" && typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return value;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (want === "boolean" && typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
    return value;
  }
  // 0 and 1 are the only numbers that mean a boolean without guessing. 2 or -1 might be a flag the
  // author meant something by, so they stay put and get reported.
  if (want === "boolean" && (value === 0 || value === 1)) return value === 1;
  if (want === "string" && (typeof value === "number" || typeof value === "boolean")) {
    return String(value);
  }
  return value;
}

/**
 * Values whose canonical spelling differs from the wire's, where a plain type conversion cannot
 * bridge the gap. SillyTavern spells "no post-processing" as the EMPTY STRING; canonical spells it
 * `none`. Every other value of that field passes through unchanged, including the `_tools` variants
 * and the deprecated `claude`, because they are distinct operations and folding them would change
 * what the preset does.
 */
const WIRE_VALUE_ALIASES: Record<string, Record<string, string>> = {
  promptPostProcessing: { "": "none" },
};

/** Copy present wire fields into a settings group; returns undefined when nothing was present. */
function mapGroup<T>(
  raw: Rec,
  fields: ReadonlyArray<readonly [string, string]>,
  schema?: unknown,
): T | undefined {
  const want = schema ? expectedTypes(schema) : undefined;
  const out: Rec = {};
  for (const [wire, canon] of fields) {
    if (wire in raw && raw[wire] !== undefined && raw[wire] !== null) {
      const coerced = coerce(raw[wire], want?.get(canon));
      const alias = typeof coerced === "string" ? WIRE_VALUE_ALIASES[canon]?.[coerced] : undefined;
      out[canon] = alias ?? coerced;
    }
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
}

/**
 * Positive detection (spec "Detection"): prompts[] or prompt_order[] arrays, or the
 * temperature-led sampler grid with a chat-completion companion. Instruct/context templates and
 * textgen `temp` grids carry none of these. Envelope owners (lumiverse wrapper, marinara
 * envelope, RC library wrapper) are refused here so each stays with its own codec.
 */
export function detectStPreset(json: unknown): boolean {
  if (!isRec(json)) return false;
  if (typeof json.type === "string") return false; // lumiverse_preset / marinara_* envelopes
  if (typeof (json as { exportedAt?: unknown }).exportedAt === "string" && isRec(json.data)) return false;
  if (Array.isArray(json.prompts) || Array.isArray(json.prompt_order)) return true;
  const companions = ["top_p", "openai_max_context", "openai_max_tokens", "impersonation_prompt", "chat_completion_source"];
  return "temperature" in json && companions.some((k) => k in json);
}

// -- divider dialect detection (NemoPresetExt conventions) ----------------------------------------

const LEGACY_MARKER_RE = /[━\-─–]{2}/;
const WIKI_CATEGORY_RE = /^===(.+)===$/;
const WIKI_SUB_RE = /^<([^>]+)>$/;

export type DividerDialect = "legacy" | "nemo-wiki" | "none";

function isLegacyDivider(name: string, content: string): boolean {
  return LEGACY_MARKER_RE.test(name) && content.trim() === "";
}
const stripLegacyName = (name: string): string => name.replace(/[━\-─–]/g, "").trim();

/** Scan ALL prompts once: any wiki-pattern name makes the whole file nemo-wiki (never mixed). */
export function detectDialect(rows: Rec[]): DividerDialect {
  let sawLegacy = false;
  for (const r of rows) {
    const name = str(r.name) ?? "";
    if (WIKI_CATEGORY_RE.test(name) || WIKI_SUB_RE.test(name)) return "nemo-wiki";
    if (isLegacyDivider(name, str(r.content) ?? "")) sawLegacy = true;
  }
  return sawLegacy ? "legacy" : "none";
}

// -- parse ---------------------------------------------------------------------------------------

export interface ParsedStPreset {
  prompts: PresetPrompt[];
  groups: PresetGroup[];
  samplers?: PresetSamplers;
  systemPrompts?: PresetSystemPrompts;
  templates?: PresetTemplates;
  behavior?: PresetBehavior;
  apiOptions?: PresetApiOptions;
  media?: PresetMedia;
  generation?: PresetGeneration;
  dialect: DividerDialect;
  /** parse honesty notes (duplicate identifiers skipped, order refs to missing prompts) */
  warnings: string[];
}

function parseRealPrompt(r: Rec): PresetPrompt {
  const id = str(r.identifier) ?? "";
  const explicitMarker = bool(r.marker);
  const marker = explicitMarker !== undefined ? explicitMarker : DEFAULT_MARKER_IDENTIFIERS.has(id);
  const role = str(r.role);
  const position = num(r.injection_position);
  const p: PresetPrompt = {
    id,
    name: str(r.name) ?? "",
    content: str(r.content) ?? "",
    role: (role === "user" || role === "assistant" || role === "tool" ? role : "system") as PromptRole,
    enabled: r.enabled !== false, // provisional; the global order pass overwrites (spec law)
    systemPrompt: r.system_prompt === true,
    marker,
    placement: PLACEMENT_BY_POSITION[position ?? 0] ?? "relative",
    injectionDepth: num(r.injection_depth) ?? 4,
    injectionOrder: num(r.injection_order) ?? 100,
    forbidOverrides: r.forbid_overrides === true,
  };
  if (marker && DEFAULT_MARKER_IDENTIFIERS.has(id)) p.markerSlot = id;
  const trigger = Array.isArray(r.injection_trigger)
    ? r.injection_trigger.filter((t): t is string => typeof t === "string")
    : [];
  if (trigger.length > 0) p.injectionTrigger = trigger;
  if (DEFAULT_PROMPT_IDENTIFIERS.has(id) && !UUID_RE.test(id)) p.isDefault = true;
  if (position !== undefined && !(position in PLACEMENT_BY_POSITION)) {
    p.extras = { injectionPositionRaw: position };
  }
  return p;
}

/** The working sequence per the spec's "enabled lives in prompt_order" law. */
function resolveSequence(
  rows: Rec[],
  rawOrder: unknown,
  warnings: string[],
): { sequence: Rec[]; enabledById: Map<string, boolean> } {
  const byId = new Map<string, Rec>();
  for (const r of rows) {
    const id = str(r.identifier);
    if (id === undefined) continue;
    if (byId.has(id)) {
      warnings.push(`duplicate prompt identifier "${id}" - first occurrence kept`);
      continue;
    }
    byId.set(id, r);
  }
  const orders = Array.isArray(rawOrder) ? rawOrder.filter(isRec) : [];
  const global = orders.find((o) => o.character_id === 100001 || o.character_id === "100001");
  const globalOrder = Array.isArray(global?.order) ? global.order.filter(isRec) : [];
  const enabledById = new Map<string, boolean>();
  if (globalOrder.length === 0) {
    for (const [id, r] of byId) enabledById.set(id, r.enabled !== false);
    return { sequence: [...byId.values()], enabledById };
  }
  const sequence: Rec[] = [];
  const referenced = new Set<string>();
  for (const item of globalOrder) {
    const id = str(item.identifier);
    if (id === undefined) continue;
    const row = byId.get(id);
    if (!row) {
      warnings.push(`prompt_order references missing prompt "${id}" - skipped`);
      continue;
    }
    if (referenced.has(id)) continue;
    referenced.add(id);
    sequence.push(row);
    enabledById.set(id, item.enabled !== false);
  }
  for (const [id, row] of byId) {
    if (referenced.has(id)) continue;
    // unreferenced prompts append DISABLED: dropping them was silent data loss (spec, step 3)
    sequence.push(row);
    enabledById.set(id, false);
  }
  return { sequence, enabledById };
}

/** Parse a raw ST preset object into canonical pieces (the emit half replays from the twin). */
export function parseStPreset(raw: Rec): ParsedStPreset {
  const warnings: string[] = [];
  const rows = (Array.isArray(raw.prompts) ? raw.prompts : []).filter(isRec);
  const dialect = detectDialect(rows);
  const { sequence, enabledById } = resolveSequence(rows, raw.prompt_order, warnings);

  const prompts: PresetPrompt[] = [];
  const groups: PresetGroup[] = [];
  let openCategory: PresetGroup | null = null;
  let openSub: PresetGroup | null = null;

  for (const row of sequence) {
    const name = str(row.name) ?? "";
    const content = str(row.content) ?? "";
    const id = str(row.identifier) ?? "";
    if (dialect === "nemo-wiki") {
      const cat = WIKI_CATEGORY_RE.exec(name);
      if (cat) {
        openCategory = { id, name: cat[1]!.trim(), extras: { stDividerName: name } };
        if (content.trim() !== "") openCategory.content = content;
        groups.push(openCategory);
        openSub = null; // a new category closes any open subcategory stack
        continue;
      }
      const sub = WIKI_SUB_RE.exec(name);
      if (sub && openCategory) {
        openSub = { id, name: sub[1]!.trim(), parentGroupId: openCategory.id, extras: { stDividerName: name } };
        if (content.trim() !== "") openSub.content = content;
        groups.push(openSub);
        continue;
      }
      // a subcategory with no open category falls through as an ordinary prompt (spec edge 7)
    } else if (dialect === "legacy" && isLegacyDivider(name, content)) {
      openCategory = { id, name: stripLegacyName(name), extras: { stDividerName: name } };
      groups.push(openCategory);
      openSub = null;
      continue;
    }
    const p = parseRealPrompt(row);
    p.enabled = enabledById.get(p.id) ?? p.enabled;
    const home = openSub ?? openCategory;
    if (home) p.groupId = home.id;
    prompts.push(p);
  }

  return {
    prompts,
    groups,
    samplers: mapGroup<PresetSamplers>(raw, SAMPLER_FIELDS, samplerSchema),
    systemPrompts: mapGroup<PresetSystemPrompts>(raw, SYSTEM_PROMPT_FIELDS, systemPromptSchema),
    templates: mapGroup<PresetTemplates>(raw, TEMPLATE_FIELDS, templateSchema),
    behavior: mapGroup<PresetBehavior>(raw, BEHAVIOR_FIELDS, behaviorSchema),
    apiOptions: mapGroup<PresetApiOptions>(raw, API_OPTION_FIELDS, apiSchema),
    media: mapGroup<PresetMedia>(raw, MEDIA_FIELDS, mediaSchema),
    generation: mapGroup<PresetGeneration>(raw, GENERATION_FIELDS, generationSchema),
    dialect,
    warnings,
  };
}

/** Assemble a PresetBody from parsed pieces (sparse: empty groups/settings stay absent). */
export function parsedToBody(name: string, parsed: ParsedStPreset): PresetBody {
  const body: PresetBody = { name, prompts: parsed.prompts };
  if (parsed.groups.length > 0) body.groups = parsed.groups;
  if (parsed.samplers) body.samplers = parsed.samplers;
  if (parsed.systemPrompts) body.systemPrompts = parsed.systemPrompts;
  if (parsed.templates) body.templates = parsed.templates;
  if (parsed.behavior) body.behavior = parsed.behavior;
  if (parsed.apiOptions) body.apiOptions = parsed.apiOptions;
  if (parsed.media) body.media = parsed.media;
  if (parsed.generation) body.generation = parsed.generation;
  return body;
}
