/**
 * Marinara-Engine regex-script mapping (REGEX-JEWEL-PLAN.md Phase R1, must #5 and #6). Marinara
 * has no standalone regex file/adapter folder (it rides the generic extensions bag per
 * `extension-platforms.ts`) so this is a plain mapping module: one Marinara `RegexScript` wire
 * row <-> one canonical `RegexRule`. Field shape verified against
 * `<local>/Marinara-Engine\packages\shared\src\types\regex.ts` and the tolerant
 * parsing precedent in `packages\server\src\services\regex\regex-application.ts` (the live engine's
 * own defensive readers - mirrored here so this codec agrees with what the server actually accepts).
 * Divergence facts: see design/REGEX-FORMATS.md axes 2-4 and the Marinara-Engine section.
 *
 * Depth semantics (R1 residual, resolved): `regex-application.ts`
 * `applyRegexScriptsToPromptMessages` computes `depth = totalMessages - 1 - index` walking the
 * `messages` array oldest-first, so the LAST message (index totalMessages-1) is depth 0 and depth
 * grows toward the oldest message - the same convention as SillyTavern (depth 0 = most recent).
 * `minDepth`/`maxDepth` skip a script when `depth < minDepth` or `depth > maxDepth`. This codec only
 * maps the stored fields; the depth walk itself lives in the future core/regex engine (R2).
 *
 * NOTE: standalone mapping module, not yet wired into extension-platforms.ts (that file's
 * `originalFields`/`carries` lists are coverage-only and are owned by another concern; wiring the
 * regex mapping into the extension-platform coverage entry is a follow-up step once the regex entity
 * itself is registry-wired - out of this phase's scope).
 */
import type { RegexPhase, RegexRule, RegexTargetChannel } from "../../entities/regex/schema";

/** Marinara's two-placement subset (design/REGEX-FORMATS.md divergence axis 2). */
export type MarinaraRegexPlacement = "ai_output" | "user_input";

/**
 * One Marinara account/character regex script, as stored and served by Marinara-Engine
 * (`packages/shared/src/types/regex.ts`). Pattern is bare with a separate `flags` field (the
 * Risu/RC/Lumi encoding, not ST's wrapped `/pattern/flags` string, despite the "ST-compatible" name).
 */
export interface MarinaraRegexScript {
  id: string;
  name: string;
  enabled: boolean;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placement: MarinaraRegexPlacement[];
  flags: string;
  promptOnly: boolean;
  targetCharacterIds: string[];
  order: number;
  minDepth: number | null;
  maxDepth: number | null;
  createdAt: string;
  updatedAt: string;
}

// -- tolerant readers (boundary parse, never throw; mirrors regex-application.ts's own helpers) --

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return [];
}

function asPlacementArray(value: unknown): MarinaraRegexPlacement[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is MarinaraRegexPlacement => entry === "ai_output" || entry === "user_input");
}

function asDepth(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Parse one untrusted script row into a known MarinaraRegexScript, or null if it does not look
 * like one (fail closed - the boundary rule: parse untrusted input once into a known type).
 */
export function readMarinaraRegexScript(raw: unknown): MarinaraRegexScript | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.findRegex !== "string") return null;
  return {
    id: r.id,
    name: asString(r.name, ""),
    enabled: asBoolean(r.enabled),
    findRegex: r.findRegex,
    replaceString: asString(r.replaceString, ""),
    trimStrings: asStringArray(r.trimStrings),
    placement: asPlacementArray(r.placement),
    flags: asString(r.flags, ""),
    promptOnly: asBoolean(r.promptOnly),
    targetCharacterIds: asStringArray(r.targetCharacterIds),
    order: typeof r.order === "number" && Number.isFinite(r.order) ? r.order : 0,
    minDepth: asDepth(r.minDepth),
    maxDepth: asDepth(r.maxDepth),
    createdAt: asString(r.createdAt, ""),
    updatedAt: asString(r.updatedAt, ""),
  };
}

/** Parse an untrusted array of script rows; malformed rows are dropped, never thrown. */
export function readMarinaraRegexScripts(raw: unknown): MarinaraRegexScript[] {
  if (!Array.isArray(raw)) return [];
  const out: MarinaraRegexScript[] = [];
  for (const entry of raw) {
    const script = readMarinaraRegexScript(entry);
    if (script) out.push(script);
  }
  return out;
}

const PLACEMENT_TO_PHASE: Record<MarinaraRegexPlacement, RegexPhase> = {
  user_input: "input",
  ai_output: "output",
};

const PHASE_TO_PLACEMENT: Partial<Record<RegexPhase, MarinaraRegexPlacement>> = {
  input: "user_input",
  output: "ai_output",
};

/** Marinara `placement[]` -> canonical `phases[]` (deliberate 2-phase subset, order preserved). */
function placementToPhases(placement: readonly MarinaraRegexPlacement[]): RegexPhase[] {
  const phases: RegexPhase[] = [];
  for (const p of placement) {
    const phase = PLACEMENT_TO_PHASE[p];
    if (!phases.includes(phase)) phases.push(phase);
  }
  return phases;
}

/**
 * Canonical `phases[]` -> Marinara `placement[]`. Phases outside Marinara's input/output subset
 * are capability-hidden here (Marinara has no wire slot for them) - this is expected translation
 * loss when exporting a foreign-authored rule TO Marinara, not a round-trip loss on Marinara's own
 * data (a rule read FROM Marinara only ever carries input/output phases).
 */
function phasesToPlacement(phases: readonly RegexPhase[]): MarinaraRegexPlacement[] {
  const placement: MarinaraRegexPlacement[] = [];
  for (const phase of phases) {
    const p = PHASE_TO_PLACEMENT[phase];
    if (p && !placement.includes(p)) placement.push(p);
  }
  return placement;
}

/** Marinara `promptOnly` <-> canonical `targets` fold (divergence axis 3: promptOnly ~ RC prompt_only). */
function promptOnlyToTargets(promptOnly: boolean): RegexTargetChannel[] | undefined {
  return promptOnly ? ["prompt"] : undefined;
}

function targetsToPromptOnly(targets: readonly RegexTargetChannel[] | undefined): boolean {
  return Array.isArray(targets) && targets.includes("prompt");
}

/** One Marinara script -> one canonical rule. `createdAt`/`updatedAt` have no canonical home; sealed in `extras`. */
export function marinaraScriptToRule(script: MarinaraRegexScript): RegexRule {
  return {
    id: script.id,
    label: script.name,
    find: script.findRegex,
    flags: script.flags,
    replace: script.replaceString,
    trimStrings: script.trimStrings.length > 0 ? script.trimStrings : undefined,
    phases: placementToPhases(script.placement),
    targets: promptOnlyToTargets(script.promptOnly),
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
    characterIds: script.targetCharacterIds.length > 0 ? script.targetCharacterIds : undefined,
    enabled: script.enabled,
    sortOrder: script.order,
    extras: { marinaraCreatedAt: script.createdAt, marinaraUpdatedAt: script.updatedAt },
  };
}

/** Parse untrusted rows straight to canonical rules (drops rows that fail the boundary parse). */
export function marinaraScriptsToRules(raw: unknown): RegexRule[] {
  return readMarinaraRegexScripts(raw).map(marinaraScriptToRule);
}

function extraString(extras: Record<string, unknown> | undefined, key: string): string {
  const value = extras?.[key];
  return typeof value === "string" ? value : "";
}

/** One canonical rule -> one Marinara script. Inverse of `marinaraScriptToRule`. */
export function ruleToMarinaraScript(rule: RegexRule): MarinaraRegexScript {
  return {
    id: rule.id,
    name: rule.label,
    enabled: rule.enabled,
    findRegex: rule.find,
    replaceString: rule.replace,
    trimStrings: rule.trimStrings ?? [],
    placement: phasesToPlacement(rule.phases),
    flags: rule.flags,
    promptOnly: targetsToPromptOnly(rule.targets),
    targetCharacterIds: rule.characterIds ?? [],
    order: rule.sortOrder,
    minDepth: rule.minDepth ?? null,
    maxDepth: rule.maxDepth ?? null,
    createdAt: extraString(rule.extras, "marinaraCreatedAt"),
    updatedAt: extraString(rule.extras, "marinaraUpdatedAt"),
  };
}

export function rulesToMarinaraScripts(rules: readonly RegexRule[]): MarinaraRegexScript[] {
  return rules.map(ruleToMarinaraScript);
}
