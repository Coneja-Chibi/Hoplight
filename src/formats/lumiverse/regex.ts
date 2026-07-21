/**
 * Lumiverse regex codec: two real wire shapes converge on the canonical RegexRule
 * (entities/regex/schema.ts). Field map + cross-format survey lives in design/REGEX-FORMATS.md -
 * read it before touching this file.
 *
 * 1. `LumiverseRegexScriptWire` - the full ACCOUNT `RegexScript` (Lumiverse staging branch
 *    `frontend/src/types/regex.ts`): carries `id/user_id/script_id/scope/scope_id/folder/pack_id/
 *    preset_id/created_at/updated_at`, `target` as an ARRAY. This is what the versioned standalone
 *    export file (`{ version: 1, type: "lumiverse_regex_scripts", scripts: [...] }`) carries, both
 *    ways (`decodeLumiverseRegexFile` / `encodeLumiverseRegexFile`).
 * 2. `LumiverseModuleRegexScript` - the REDUCED shape actually embedded in a character archive's
 *    `lumiverse_modules.json` `regex_scripts[]`. Confirmed by reading
 *    `character-export.service.ts` / `character-card.service.ts` `BundledRegexScript` directly
 *    (REGEX-JEWEL-PLAN.md R1 residual Q2, 2026-07-11): no `id/user_id/script_id/folder/pack_id/
 *    preset_id/created_at/updated_at`, `scope_id` is always written null, and - the field that
 *    differs in TYPE, not just presence - `target` is a single STRING, not an array. Wired through
 *    `modules.ts` (`decodeLumiverseModuleRegexScripts` / `encodeLumiverseModuleRegexScripts`).
 *
 * Both directions preserve every wire-only field via `RegexRule.extras` (the lossless-escrow
 * doctrine already used by every other codec in this repo) so a same-shape round trip reproduces
 * the original wire object exactly (R1 must #6).
 *
 * Phase/target facts (design/REGEX-FORMATS.md divergence axes 2-4): Lumiverse `placement` union is
 * `user_input | ai_output | world_info | reasoning | memory` (`memory` is Lumi-only among the five
 * dialects); `target` union is `prompt | response | display`; `substitute_macros` is the full
 * `none | raw | escaped | after` set. This codec only ROUND-TRIPS the "after" string - its runtime
 * meaning (macro evaluation runs on the whole post-replace string, never per-match) is R2's job,
 * answered in REGEX-JEWEL-PLAN.md R1 residual Q1.
 *
 * Safety: a rule is DATA here, never executed. Risu-only fields (useFlags) and Marinara-only
 * fields (characterIds) never round-trip through this codec - Lumiverse's wire has no home for them.
 */
import type {
  CanonicalRegexSet,
  RegexPhase,
  RegexRule,
  RegexSetBody,
  RegexSubstitution,
  RegexTargetChannel,
} from "../../entities/regex/schema";
import type { AdapterInput, AdapterOutput, RegexAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonAny } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Lumiverse `placement` <-> canonical `phase` (design/REGEX-FORMATS.md divergence axis 2). */
const PLACEMENT_TO_PHASE: Record<string, RegexPhase> = {
  user_input: "input",
  ai_output: "output",
  world_info: "lorebook",
  reasoning: "reasoning",
  memory: "memory",
};
const PHASE_TO_PLACEMENT: Partial<Record<RegexPhase, string>> = {
  input: "user_input",
  output: "ai_output",
  lorebook: "world_info",
  reasoning: "reasoning",
  memory: "memory",
};

const SUBSTITUTION_VALUES = new Set<RegexSubstitution>(["none", "raw", "escaped", "after"]);
const TARGET_VALUES = new Set<RegexTargetChannel>(["prompt", "response", "display"]);

/** placement[] -> phases[]; values outside the known table ride through in extras.unmappedPlacements. */
function decodePlacements(raw: unknown): { phases: RegexPhase[]; unmapped: string[] } {
  const phases: RegexPhase[] = [];
  const unmapped: string[] = [];
  for (const p of strArr(raw)) {
    const mapped = PLACEMENT_TO_PHASE[p];
    if (mapped) phases.push(mapped);
    else unmapped.push(p);
  }
  return { phases, unmapped };
}

/** phases[] -> placement[]; appends any preserved unmapped values so extras stay honest on re-encode. */
function encodePlacements(rule: RegexRule): string[] {
  const mapped = rule.phases
    .map((p) => PHASE_TO_PLACEMENT[p])
    .filter((p): p is string => p !== undefined);
  const unmapped = Array.isArray(rule.extras?.unmappedPlacements)
    ? (rule.extras!.unmappedPlacements as string[])
    : [];
  return [...mapped, ...unmapped];
}

function decodeSubstitute(raw: unknown): RegexSubstitution | undefined {
  return typeof raw === "string" && SUBSTITUTION_VALUES.has(raw as RegexSubstitution)
    ? (raw as RegexSubstitution)
    : undefined;
}

function decodeTargets(values: readonly string[]): RegexTargetChannel[] | undefined {
  const known = values.filter((v): v is RegexTargetChannel =>
    TARGET_VALUES.has(v as RegexTargetChannel),
  );
  return known.length ? known : undefined;
}

// ---------------------------------------------------------------------------------------------
// Shape 1: full account RegexScript (versioned standalone export file)
// ---------------------------------------------------------------------------------------------

/** Lumiverse account-scope regex script wire (frontend/src/types/regex.ts on the staging branch). */
export interface LumiverseRegexScriptWire {
  id: string;
  user_id?: string;
  name: string;
  script_id?: string;
  find_regex: string;
  replace_string: string;
  /** Interactive action blocks rendered from replacement HTML (send/append/effects rows). Sealed
   *  data: carried via extras and replayed untouched, never rendered or executed here. Optional on
   *  the wire because pre-actions exports lack the key and emit must not fabricate it. */
  actions?: unknown[];
  flags: string;
  placement: string[];
  scope?: string;
  scope_id?: string | null;
  target: string[];
  min_depth: number | null;
  max_depth: number | null;
  trim_strings: string[];
  run_on_edit: boolean;
  substitute_macros: string;
  disabled: boolean;
  sort_order: number;
  description: string;
  folder?: string;
  pack_id?: string | null;
  preset_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: number;
  updated_at?: number;
}

/** The versioned standalone export envelope (`lumiverse_regex_scripts` file type). */
export interface LumiverseRegexFile {
  version: 1;
  type: "lumiverse_regex_scripts";
  scripts: LumiverseRegexScriptWire[];
}

export function decodeLumiverseRegexScript(wire: LumiverseRegexScriptWire): RegexRule {
  const { phases, unmapped } = decodePlacements(wire.placement);
  const extras: Rec = {};
  if (wire.user_id !== undefined) extras.userId = wire.user_id;
  if (wire.script_id !== undefined) extras.scriptId = wire.script_id;
  if (wire.actions !== undefined) extras.actions = wire.actions;
  if (wire.scope !== undefined) extras.scope = wire.scope;
  if (wire.scope_id !== undefined) extras.scopeId = wire.scope_id;
  if (wire.folder !== undefined) extras.folder = wire.folder;
  if (wire.pack_id !== undefined) extras.packId = wire.pack_id;
  if (wire.preset_id !== undefined) extras.presetId = wire.preset_id;
  if (wire.metadata !== undefined) extras.metadata = wire.metadata;
  if (wire.created_at !== undefined) extras.createdAt = wire.created_at;
  if (wire.updated_at !== undefined) extras.updatedAt = wire.updated_at;
  if (unmapped.length) extras.unmappedPlacements = unmapped;

  const rule: RegexRule = {
    id: wire.id,
    label: wire.name,
    find: wire.find_regex,
    flags: wire.flags,
    replace: wire.replace_string,
    trimStrings: wire.trim_strings,
    phases,
    minDepth: wire.min_depth,
    maxDepth: wire.max_depth,
    runOnEdit: wire.run_on_edit,
    enabled: !wire.disabled,
    sortOrder: wire.sort_order,
  };
  rule.note = wire.description;
  const targets = decodeTargets(wire.target);
  if (targets) rule.targets = targets;
  const substituteFind = decodeSubstitute(wire.substitute_macros);
  if (substituteFind) rule.substituteFind = substituteFind;
  if (Object.keys(extras).length) rule.extras = extras;
  return rule;
}

export function encodeLumiverseRegexScript(rule: RegexRule): LumiverseRegexScriptWire {
  const extras = rule.extras ?? {};
  const wire: LumiverseRegexScriptWire = {
    id: rule.id,
    name: rule.label,
    find_regex: rule.find,
    replace_string: rule.replace,
    flags: rule.flags,
    placement: encodePlacements(rule),
    target: rule.targets ?? [],
    min_depth: rule.minDepth ?? null,
    max_depth: rule.maxDepth ?? null,
    trim_strings: rule.trimStrings ?? [],
    run_on_edit: rule.runOnEdit ?? false,
    substitute_macros: rule.substituteFind ?? "none",
    disabled: !rule.enabled,
    sort_order: rule.sortOrder,
    description: rule.note ?? "",
  };
  if (typeof extras.userId === "string") wire.user_id = extras.userId;
  if (typeof extras.scriptId === "string") wire.script_id = extras.scriptId;
  if (Array.isArray(extras.actions)) wire.actions = extras.actions as unknown[];
  if (typeof extras.scope === "string") wire.scope = extras.scope;
  if (extras.scopeId !== undefined) wire.scope_id = extras.scopeId as string | null;
  if (typeof extras.folder === "string") wire.folder = extras.folder;
  if (extras.packId !== undefined) wire.pack_id = extras.packId as string | null;
  if (extras.presetId !== undefined) wire.preset_id = extras.presetId as string | null;
  if (extras.metadata !== undefined) wire.metadata = extras.metadata as Record<string, unknown>;
  if (typeof extras.createdAt === "number") wire.created_at = extras.createdAt;
  if (typeof extras.updatedAt === "number") wire.updated_at = extras.updatedAt;
  return wire;
}

/** Parse the versioned standalone export file text; tolerant, returns null on anything unrecognized. */
export function decodeLumiverseRegexFile(json: string): RegexRule[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRec(parsed) || parsed.type !== "lumiverse_regex_scripts" || !Array.isArray(parsed.scripts)) {
    return null;
  }
  return parsed.scripts
    .filter(isRec)
    .map((row) => decodeLumiverseRegexScript(row as unknown as LumiverseRegexScriptWire));
}

/** Serialize rules back to the versioned standalone export file. */
export function encodeLumiverseRegexFile(rules: readonly RegexRule[]): LumiverseRegexFile {
  return {
    version: 1,
    type: "lumiverse_regex_scripts",
    scripts: rules.map(encodeLumiverseRegexScript),
  };
}

// ---------------------------------------------------------------------------------------------
// Shape 2: reduced module-embedded regex (character archive lumiverse_modules.json regex_scripts[])
// ---------------------------------------------------------------------------------------------

/**
 * The reduced shape actually written into a character archive's `regex_scripts[]`
 * (`BundledRegexScript` in `character-card.service.ts`, populated by
 * `character-export.service.ts`). No id/user_id/script_id/folder/pack_id/preset_id/created_at/
 * updated_at; `scope_id` is always exported null. `target` was a single STRING when first
 * confirmed live; upstream has since widened it to `string | string[]`, so both forms decode and
 * the wire form is remembered (extras.targetIsArray) so each file re-emits its own shape.
 */
export interface LumiverseModuleRegexScript {
  name: string;
  find_regex: string;
  replace_string: string;
  flags: string;
  placement: string[];
  scope: string;
  scope_id: string | null;
  target: string | string[];
  min_depth: number | null;
  max_depth: number | null;
  trim_strings: string[];
  run_on_edit: boolean;
  substitute_macros: string;
  disabled: boolean;
  sort_order: number;
  description: string;
  metadata: Record<string, unknown>;
}

function decodeModuleRegexScript(wire: LumiverseModuleRegexScript, fallbackId: string): RegexRule {
  const { phases, unmapped } = decodePlacements(wire.placement);
  const extras: Rec = {
    scope: wire.scope,
    scopeId: wire.scope_id,
    metadata: wire.metadata,
  };
  if (Array.isArray(wire.target)) extras.targetIsArray = true;
  if (unmapped.length) extras.unmappedPlacements = unmapped;

  const rule: RegexRule = {
    id: fallbackId,
    label: wire.name,
    find: wire.find_regex,
    flags: wire.flags,
    replace: wire.replace_string,
    trimStrings: wire.trim_strings,
    phases,
    minDepth: wire.min_depth,
    maxDepth: wire.max_depth,
    runOnEdit: wire.run_on_edit,
    enabled: !wire.disabled,
    sortOrder: wire.sort_order,
    extras,
  };
  rule.note = wire.description;
  const targetList = Array.isArray(wire.target) ? wire.target : wire.target ? [wire.target] : [];
  const targets = decodeTargets(targetList);
  if (targets) rule.targets = targets;
  const substituteFind = decodeSubstitute(wire.substitute_macros);
  if (substituteFind) rule.substituteFind = substituteFind;
  return rule;
}

function encodeModuleRegexScript(rule: RegexRule): LumiverseModuleRegexScript {
  const extras = rule.extras ?? {};
  return {
    name: rule.label,
    find_regex: rule.find,
    replace_string: rule.replace,
    flags: rule.flags,
    placement: encodePlacements(rule),
    scope: typeof extras.scope === "string" ? extras.scope : "character",
    scope_id: extras.scopeId !== undefined ? (extras.scopeId as string | null) : null,
    target: extras.targetIsArray === true ? (rule.targets ?? []) : (rule.targets?.[0] ?? ""),
    min_depth: rule.minDepth ?? null,
    max_depth: rule.maxDepth ?? null,
    trim_strings: rule.trimStrings ?? [],
    run_on_edit: rule.runOnEdit ?? false,
    substitute_macros: rule.substituteFind ?? "none",
    disabled: !rule.enabled,
    sort_order: rule.sortOrder,
    description: rule.note ?? "",
    metadata: (extras.metadata as Record<string, unknown>) ?? {},
  };
}

/** Decode a raw archive `regex_scripts[]` array (tolerant: bad rows are skipped, never thrown). */
export function decodeLumiverseModuleRegexScripts(wire: unknown): RegexRule[] {
  if (!Array.isArray(wire)) return [];
  return wire
    .filter(isRec)
    .map((row, i) =>
      decodeModuleRegexScript(row as unknown as LumiverseModuleRegexScript, `lumiverse-module-regex-${i}`),
    );
}

/** Encode canonical rules back to the archive-embedded reduced shape. */
export function encodeLumiverseModuleRegexScripts(
  rules: readonly RegexRule[],
): LumiverseModuleRegexScript[] {
  return rules.map(encodeModuleRegexScript);
}

// ---------------------------------------------------------------------------------------------
// Adapter shell (registered via lumiverse/index.ts's family array)
// ---------------------------------------------------------------------------------------------

/**
 * File home: shape 1's versioned standalone export envelope. It self-identifies
 * (`type: "lumiverse_regex_scripts"`), so detection is 1.0 - no other dialect can collide with an
 * explicit type tag. Shape 2 (module-embedded) has no standalone file of its own; it arrives inside
 * a character archive and stays that import path's concern.
 */
export const regexAdapter: RegexAdapter = {
  id: "lumiverse-regex",
  label: "Lumiverse regex scripts (versioned export file)",
  outputExtensions: ["json"],
  kind: "regex",

  detect(input: AdapterInput): number {
    const json = readJsonAny(input);
    return isRec(json) && json.type === "lumiverse_regex_scripts" && Array.isArray(json.scripts)
      ? 1
      : 0;
  },

  toCanonical(input: AdapterInput): CanonicalRegexSet {
    const text = input.text ?? (input.bytes ? new TextDecoder().decode(input.bytes) : "");
    const rules = decodeLumiverseRegexFile(text);
    if (!rules) throw new Error("lumiverse-regex: not a recognizable Lumiverse regex export file");
    const body: RegexSetBody = {
      name: setNameFromFilename(input, "Imported regex scripts"),
      rules,
    };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "regex",
      id: canonicalId(body.name),
      body,
      original: { "lumiverse-regex": { raw: JSON.parse(text) as unknown } },
    };
  },

  fromCanonical(entity: CanonicalRegexSet): AdapterOutput {
    const file = encodeLumiverseRegexFile(entity.body.rules);
    return { text: JSON.stringify(file, null, 2), suggestedExtension: "json" };
  },
};
