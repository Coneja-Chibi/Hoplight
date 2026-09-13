/**
 * Marinara-Engine prompt-preset codec (canonical kind "preset"). Reads and writes the
 * `marinara_preset` export envelope: the prompt-manager preset the engine serves from
 * `GET /prompts/:id/export` (Marinara-Engine@daf8c212,
 * packages/server/src/routes/prompts.routes.ts:42-57), shaped
 * `{ type, version, exportedAt, data: { preset, sections, groups, choiceBlocks } }`.
 *
 * WIRE QUIRK (load-bearing): the payload is a raw DB row, so booleans arrive as the STRINGS
 * "true"/"false" (section enabled/isMarker/wrapInXml/forbidOverrides, group enabled, choice
 * multiSelect/randomPick) and nested structures arrive as JSON STRINGS (preset parameters /
 * sectionOrder / groupOrder / variableGroups / variableValues / defaultChoices, section
 * markerConfig, choice options). Verified against the engine's own bundled export
 * (Marinara-Engine@daf8c212, packages/server/src/db/default-preset.json). Field vocabulary:
 * packages/shared/src/schemas/prompt.schema.ts createPromptSectionSchema:179-193,
 * createPromptGroupSchema:132-138, createChoiceBlockSchema:102-112,
 * generationParametersSchema:37-78, createPromptPresetSchema:149-160.
 *
 * ESCROW + OVERLAY: the whole parsed envelope is stashed verbatim under
 * original["marinara-preset"].raw. On emit the raw twin is cloned and only the fields whose
 * canonical value DIFFERS from the twin's own decoded value are written back (re-encoded to the
 * wire's string forms), so an unedited round-trip is byte-identical and every Marinara-only field
 * with no canonical home (the variable layer, conversationPrompt/gamePrompt, wrapFormat, author,
 * defaultChoices, ids/ordering, and the parameters the canonical samplers do not cover) survives
 * untouched. Scripts are never executed; a preset is pure data.
 */
import type { AdapterInput, AdapterOutput } from "../../core/adapter";
import type {
  CanonicalPreset,
  PresetApiOptions,
  PresetBody,
  PresetChoice,
  PresetChoiceOption,
  PresetGroup,
  PresetPrompt,
  PresetSamplers,
  PromptPlacement,
  PromptRole,
} from "../../entities/preset/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";

const FORMAT_ID = "marinara-preset";
const ENVELOPE_TYPE = "marinara_preset";

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

/** Wire booleans are the strings "true"/"false" (raw DB row); tolerate a real boolean too. */
const boolWire = (v: unknown): boolean => v === true || v === "true";
/** Encode a canonical boolean back to the wire's string form. */
const boolStr = (b: boolean): string => (b ? "true" : "false");

/** Parse a JSON-string wire field; returns fallback on anything unreadable (fail closed). */
function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// ── detection ────────────────────────────────────────────────────────────────

/** The parsed envelope iff it is structurally a marinara_preset export, else null. */
function readEnvelope(input: AdapterInput): Rec | null {
  const o = readJsonObject(input);
  if (!o) return null;
  if (o.type !== ENVELOPE_TYPE) return null;
  if (!isRec(o.data)) return null;
  if (!isRec(o.data.preset)) return null;
  if (!Array.isArray(o.data.sections)) return null;
  return o;
}

// ── wire -> canonical ──────────────────────────────────────────────────────────

/** Marinara injectionPosition -> canonical placement (the engine has only these two). */
const placementFromWire = (v: unknown): PromptPlacement =>
  v === "depth" ? "in_chat" : "relative";
/** Canonical placement -> Marinara injectionPosition. */
const placementToWire = (p: PromptPlacement): string =>
  p === "in_chat" || p === "append" ? "depth" : "ordered";

const roleFromWire = (v: unknown): PromptRole =>
  v === "user" || v === "assistant" || v === "tool" ? v : "system";

function sectionToPrompt(s: Rec): PresetPrompt {
  const marker = boolWire(s.isMarker);
  const prompt: PresetPrompt = {
    id: str(s.identifier) ?? "",
    name: str(s.name) ?? "",
    content: str(s.content) ?? "",
    role: roleFromWire(s.role),
    enabled: boolWire(s.enabled),
    systemPrompt: false,
    marker,
    placement: placementFromWire(s.injectionPosition),
    injectionDepth: num(s.injectionDepth) ?? 0,
    injectionOrder: num(s.injectionOrder) ?? 100,
    forbidOverrides: boolWire(s.forbidOverrides),
  };
  if (marker) {
    const slot = str((parseJson<Rec>(s.markerConfig, {})).type);
    if (slot) prompt.markerSlot = slot;
  }
  const groupId = str(s.groupId);
  if (groupId) prompt.groupId = groupId;
  if (boolWire(s.wrapInXml)) prompt.wrapInXml = true;
  const tag = str(s.xmlTagName);
  if (tag) prompt.xmlTagName = tag;
  return prompt;
}

function groupToCanonical(g: Rec): PresetGroup {
  const group: PresetGroup = { id: str(g.id) ?? "", name: str(g.name) ?? "" };
  const parent = str(g.parentGroupId);
  if (parent) group.parentGroupId = parent;
  const order = num(g.order);
  if (order !== undefined) group.order = order;
  if ("enabled" in g) group.enabled = boolWire(g.enabled);
  return group;
}

function choiceToCanonical(c: Rec): PresetChoice {
  const rawOptions = parseJson<unknown[]>(c.options, []);
  const options: PresetChoiceOption[] = rawOptions.filter(isRec).map((o) => ({
    id: str(o.id) ?? "",
    label: str(o.label) ?? "",
    value: str(o.value) ?? "",
  }));
  const choice: PresetChoice = {
    id: str(c.id) ?? "",
    label: str(c.question) ?? "",
    type: boolWire(c.multiSelect) ? "many" : "one",
    options,
  };
  const key = str(c.variableName);
  if (key) choice.key = key;
  const sep = str(c.separator);
  if (sep !== undefined) choice.separator = sep;
  if (boolWire(c.randomPick)) choice.randomPick = true;
  const sortOrder = num(c.sortOrder);
  if (sortOrder !== undefined) choice.sortOrder = sortOrder;
  return choice;
}

const SAMPLER_KEYS = [
  "temperature",
  "topP",
  "topK",
  "minP",
  "maxTokens",
  "maxContext",
  "frequencyPenalty",
  "presencePenalty",
] as const;

function paramsToSamplers(p: Rec): PresetSamplers {
  const out: PresetSamplers = {};
  for (const k of SAMPLER_KEYS) {
    const v = num(p[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function paramsToApiOptions(p: Rec): PresetApiOptions {
  const out: PresetApiOptions = {};
  if (typeof p.squashSystemMessages === "boolean") out.squashSystemMessages = p.squashSystemMessages;
  if (typeof p.showThoughts === "boolean") out.showThoughts = p.showThoughts;
  const effort = str(p.reasoningEffort);
  if (effort) out.reasoningEffort = effort;
  return out;
}

/** Map a parsed envelope to the canonical body. Shared by import and the emit-time diff. */
function envelopeToBody(env: Rec): PresetBody {
  const data = env.data as Rec;
  const preset = data.preset as Rec;
  const sections = (data.sections as unknown[]).filter(isRec);
  const groups = Array.isArray(data.groups) ? data.groups.filter(isRec) : [];
  const choices = Array.isArray(data.choiceBlocks) ? data.choiceBlocks.filter(isRec) : [];
  const params = parseJson<Rec>(preset.parameters, {});

  const body: PresetBody = {
    name: str(preset.name) ?? "Untitled preset",
    prompts: sections.map(sectionToPrompt),
  };
  const description = str(preset.description);
  if (description) body.description = description;
  if (groups.length > 0) body.groups = groups.map(groupToCanonical);
  if (choices.length > 0) body.choices = choices.map(choiceToCanonical);
  const samplers = paramsToSamplers(params);
  if (Object.keys(samplers).length > 0) body.samplers = samplers;
  const apiOptions = paramsToApiOptions(params);
  if (Object.keys(apiOptions).length > 0) body.apiOptions = apiOptions;
  return body;
}

// ── canonical -> wire (clone the raw twin, write back only what changed) ────────

/** Write back the mapped scalar section fields whose canonical value drifted from the twin's. */
function patchSection(raw: Rec, live: PresetPrompt, twin: PresetPrompt): void {
  if (live.name !== twin.name) raw.name = live.name;
  if (live.content !== twin.content) raw.content = live.content;
  if (live.role !== twin.role) raw.role = live.role;
  if (live.enabled !== twin.enabled) raw.enabled = boolStr(live.enabled);
  if (live.marker !== twin.marker) raw.isMarker = boolStr(live.marker);
  if (live.forbidOverrides !== twin.forbidOverrides) {
    raw.forbidOverrides = boolStr(live.forbidOverrides);
  }
  if (live.placement !== twin.placement) raw.injectionPosition = placementToWire(live.placement);
  if (live.injectionDepth !== twin.injectionDepth) raw.injectionDepth = live.injectionDepth;
  if (live.injectionOrder !== twin.injectionOrder) raw.injectionOrder = live.injectionOrder;
  if ((live.groupId ?? null) !== (twin.groupId ?? null)) raw.groupId = live.groupId ?? null;
  if ((live.wrapInXml ?? false) !== (twin.wrapInXml ?? false)) {
    raw.wrapInXml = boolStr(live.wrapInXml ?? false);
  }
  if ((live.xmlTagName ?? "") !== (twin.xmlTagName ?? "")) raw.xmlTagName = live.xmlTagName ?? "";
  if ((live.markerSlot ?? "") !== (twin.markerSlot ?? "")) {
    if (!live.markerSlot) {
      raw.markerConfig = null;
    } else {
      // Overwrite only .type; the engine's markerConfig also carries characterFields /
      // lorebookFormat / chatHistoryOptions / agentType siblings that must survive a slot change.
      let cfg: Record<string, unknown> = {};
      if (typeof raw.markerConfig === "string") {
        try {
          const parsed: unknown = JSON.parse(raw.markerConfig);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            cfg = parsed as Record<string, unknown>;
          }
        } catch {
          // unparseable escrow config: fall through to a fresh { type } object
        }
      }
      cfg.type = live.markerSlot;
      raw.markerConfig = JSON.stringify(cfg);
    }
  }
}

function patchGroup(raw: Rec, live: PresetGroup, twin: PresetGroup): void {
  if (live.name !== twin.name) raw.name = live.name;
  if ((live.order ?? null) !== (twin.order ?? null)) raw.order = live.order ?? null;
  if ((live.enabled ?? null) !== (twin.enabled ?? null)) {
    raw.enabled = boolStr(live.enabled ?? true);
  }
  if ((live.parentGroupId ?? null) !== (twin.parentGroupId ?? null)) {
    raw.parentGroupId = live.parentGroupId ?? null;
  }
}

function patchChoice(raw: Rec, live: PresetChoice, twin: PresetChoice): void {
  if (live.label !== twin.label) raw.question = live.label;
  if ((live.key ?? "") !== (twin.key ?? "")) raw.variableName = live.key ?? "";
  if (live.type !== twin.type) raw.multiSelect = boolStr(live.type === "many");
  if ((live.separator ?? "") !== (twin.separator ?? "")) raw.separator = live.separator ?? "";
  if ((live.randomPick ?? false) !== (twin.randomPick ?? false)) {
    raw.randomPick = boolStr(live.randomPick ?? false);
  }
  if ((live.sortOrder ?? null) !== (twin.sortOrder ?? null)) raw.sortOrder = live.sortOrder ?? null;
  if (!deepEq(live.options, twin.options)) raw.options = JSON.stringify(live.options);
}

/** Overlay changed sampler/apiOption values onto the twin's parsed parameters, preserving the rest. */
function patchParameters(preset: Rec, live: PresetBody, twin: PresetBody): void {
  const sameSamplers = deepEq(live.samplers ?? {}, twin.samplers ?? {});
  const sameApi = deepEq(live.apiOptions ?? {}, twin.apiOptions ?? {});
  if (sameSamplers && sameApi) return;
  const params = parseJson<Rec>(preset.parameters, {});
  for (const k of SAMPLER_KEYS) {
    const v = live.samplers?.[k];
    if (v !== undefined) params[k] = v;
  }
  const api = live.apiOptions;
  if (api) {
    if (api.squashSystemMessages !== undefined) params.squashSystemMessages = api.squashSystemMessages;
    if (api.showThoughts !== undefined) params.showThoughts = api.showThoughts;
    if (api.reasoningEffort !== undefined) params.reasoningEffort = api.reasoningEffort;
  }
  preset.parameters = JSON.stringify(params);
}

/** Match raw rows to canonical rows by their stable key and apply a per-row patch. */
function patchRows<T extends { id: string }>(
  rawRows: unknown,
  liveRows: T[] | undefined,
  twinRows: T[] | undefined,
  keyOf: (raw: Rec) => string | undefined,
  patch: (raw: Rec, live: T, twin: T) => void,
): void {
  if (!Array.isArray(rawRows) || !liveRows || !twinRows) return;
  const liveById = new Map(liveRows.map((r) => [r.id, r]));
  const twinById = new Map(twinRows.map((r) => [r.id, r]));
  for (const raw of rawRows) {
    if (!isRec(raw)) continue;
    const key = keyOf(raw);
    if (key === undefined) continue;
    const live = liveById.get(key);
    const twin = twinById.get(key);
    if (live && twin) patch(raw, live, twin);
  }
}

/** Build a minimal valid envelope for a from-scratch preset (no escrowed twin to clone). */
function freshEnvelope(body: PresetBody): Rec {
  const presetId = canonicalId(body.name);
  const sections = body.prompts.map((p) => ({
    id: p.id,
    presetId,
    identifier: p.id,
    name: p.name,
    content: p.content,
    role: p.role,
    enabled: boolStr(p.enabled),
    isMarker: boolStr(p.marker),
    groupId: p.groupId ?? null,
    markerConfig: p.marker && p.markerSlot ? JSON.stringify({ type: p.markerSlot }) : null,
    injectionPosition: placementToWire(p.placement),
    injectionDepth: p.injectionDepth,
    injectionOrder: p.injectionOrder,
    wrapInXml: boolStr(p.wrapInXml ?? false),
    xmlTagName: p.xmlTagName ?? "",
    forbidOverrides: boolStr(p.forbidOverrides),
  }));
  const groups = (body.groups ?? []).map((g) => ({
    id: g.id,
    presetId,
    name: g.name,
    parentGroupId: g.parentGroupId ?? null,
    order: g.order ?? 100,
    enabled: boolStr(g.enabled ?? true),
  }));
  const choiceBlocks = (body.choices ?? []).map((c) => ({
    id: c.id,
    presetId,
    // The engine enforces ^\w+$ on variableName; canonical ids carry hyphens, so sanitize.
    variableName: (c.key ?? c.id).replace(/\W/g, "_"),
    question: c.label,
    options: JSON.stringify(c.options),
    multiSelect: boolStr(c.type === "many"),
    separator: c.separator ?? ", ",
    randomPick: boolStr(c.randomPick ?? false),
    displayMode: "auto",
    optionSort: "manual",
    sortOrder: c.sortOrder ?? 100,
  }));
  const params: Rec = { ...(body.samplers ?? {}) };
  const api = body.apiOptions ?? {};
  if (api.squashSystemMessages !== undefined) params.squashSystemMessages = api.squashSystemMessages;
  if (api.showThoughts !== undefined) params.showThoughts = api.showThoughts;
  if (api.reasoningEffort !== undefined) params.reasoningEffort = api.reasoningEffort;
  const preset: Rec = {
    id: presetId,
    name: body.name,
    description: body.description ?? "",
    conversationPrompt: "",
    gamePrompt: "",
    sectionOrder: JSON.stringify(body.prompts.map((p) => p.id)),
    groupOrder: JSON.stringify((body.groups ?? []).map((g) => g.id)),
    variableGroups: "[]",
    variableValues: "{}",
    parameters: JSON.stringify(params),
    wrapFormat: "xml",
    defaultChoices: "{}",
    isDefault: "false",
    author: "",
  };
  return {
    type: ENVELOPE_TYPE,
    version: 1,
    exportedAt: "",
    data: { preset, sections, groups, choiceBlocks },
  };
}

function bodyToEnvelope(entity: CanonicalPreset): Rec {
  const twin = entity.original?.[FORMAT_ID]?.raw;
  if (!isRec(twin) || !isRec(twin.data) || !isRec((twin.data as Rec).preset)) {
    return freshEnvelope(entity.body);
  }
  const clone = structuredClone(twin) as Rec;
  const data = clone.data as Rec;
  const decoded = envelopeToBody(twin);
  const live = entity.body;

  if (live.name !== decoded.name) (data.preset as Rec).name = live.name;
  if ((live.description ?? "") !== (decoded.description ?? "")) {
    (data.preset as Rec).description = live.description ?? "";
  }
  patchParameters(data.preset as Rec, live, decoded);
  patchRows(data.sections, live.prompts, decoded.prompts, (r) => str(r.identifier), patchSection);
  patchRows(data.groups, live.groups, decoded.groups, (r) => str(r.id), patchGroup);
  patchRows(data.choiceBlocks, live.choices, decoded.choices, (r) => str(r.id), patchChoice);
  return clone;
}

// ── adapter ─────────────────────────────────────────────────────────────────────

/**
 * The Marinara prompt-preset adapter. Its shape matches the eventual `PresetAdapter` union member;
 * it is not yet added to the format registry's `FormatAdapter` union (that edit lives in
 * src/core/adapter.ts), so it is a named export the preset layer imports directly rather than a
 * loader-discovered default.
 */
export const marinaraPreset = {
  id: FORMAT_ID,
  label: "Marinara-Engine prompt preset (marinara_preset export)",
  outputExtensions: ["json"],
  kind: "preset" as const,

  detect(input: AdapterInput): number {
    return readEnvelope(input) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const env = readEnvelope(input);
    if (!env) throw new Error("marinara-preset: not a recognizable Marinara preset export");
    const body = envelopeToBody(env);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(body.name),
      body,
      original: { [FORMAT_ID]: { raw: env } },
    };
  },

  fromCanonical(entity: CanonicalPreset): AdapterOutput {
    return { text: JSON.stringify(bodyToEnvelope(entity), null, 2), suggestedExtension: "json" };
  },
};

export default marinaraPreset;
