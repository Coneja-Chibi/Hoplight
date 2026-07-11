/**
 * RoleCall regex codec (chat-pipeline scripts - the ONLY live regex subsystem in RC's app code).
 *
 * RESIDUAL RESOLVED (REGEX-JEWEL-PLAN.md R1 residual "RC subsystem A vs B", 2026-07-11): RC ships
 * two regex shapes under apps/rc/src/lib/regex/. Subsystem A (apply-regex.ts, `RegexScript { id,
 * name, rules[] }` / `RegexRule { find_pattern, replace_string, placement[], flags, ... }`) is
 * wired into every real call site: message submission (useHandleSubmit.ts, useChatMessageHandlers.ts,
 * placement "prompt_only"), display rendering (useDisplayMessages.ts), prompt-preview
 * (preview-prompt/route.ts), lorebook injection (prompt-assembly.ts), post-gen actions
 * (post-gen-actions/service.ts, placement "ai_output"). Subsystem B (lib/regex/engine.ts +
 * integration.ts: processUserInput/processAIOutput/processForDisplay, which adds a `substitution`
 * field) is dead code - only its own unit tests and an unused re-export from lib/regex/index.ts
 * reference it; no hook, route, or component calls it (grep-verified). This codec therefore models
 * subsystem A's wire ONLY. It has no `substitution` field, so this codec never reads or writes
 * canonical `substituteFind` for RoleCall, despite core/regex/platform-fields.ts currently listing
 * "substituteFind" as an RC-owned extra - that claim was written from the plan's original (wrong)
 * assumption before this residual was resolved; platform-fields.ts is not owned by this phase, so
 * the correction is recorded here rather than applied there.
 *
 * Lossless: unknown per-rule wire keys land in `RegexRule.extras` and re-emit verbatim (the
 * lossless-escrow doctrine, REGEX-FORMATS.md "Safety posture"). Unknown SCRIPT-level keys (and the
 * script's own `id`, which `RegexSetBody` has no first-class slot for) have no home in the entity
 * schema at this phase - `fromCanonical` accepts the original raw script to restore them, the same
 * "clone the wire, overlay canonical fields" shape `formats/rolecall/lorebook.ts` uses ahead of the
 * full adapter/`original` wrapper. Wiring this into a "regex" AdapterKind is a later phase
 * (core/adapter.ts is not owned here).
 */
import type { RegexPhase, RegexRule, RegexSetBody } from "../../entities/regex/schema";

/** Subsystem A's placement union (apply-regex.ts `RegexPlacement`), read defensively off the wire. */
const RC_PLACEMENTS = [
  "user_input",
  "ai_output",
  "display_only",
  "prompt_only",
  "lorebook",
  "reasoning",
] as const;
type RcPlacement = (typeof RC_PLACEMENTS)[number];

const isRcPlacement = (v: unknown): v is RcPlacement =>
  typeof v === "string" && (RC_PLACEMENTS as readonly string[]).includes(v);

const RC_PLACEMENT_TO_PHASE: Record<RcPlacement, RegexPhase> = {
  user_input: "input",
  ai_output: "output",
  display_only: "display",
  prompt_only: "prompt",
  lorebook: "lorebook",
  reasoning: "reasoning",
};

const RC_PHASE_TO_PLACEMENT: Partial<Record<RegexPhase, RcPlacement>> = {
  input: "user_input",
  output: "ai_output",
  display: "display_only",
  prompt: "prompt_only",
  lorebook: "lorebook",
  reasoning: "reasoning",
};

/** Unknown placement strings pass through verbatim (RegexPhase is an open union, forward-compat). */
const placementToPhase = (p: unknown): RegexPhase => (isRcPlacement(p) ? RC_PLACEMENT_TO_PHASE[p] : String(p));

/** A phase this codec cannot map back to an RC placement is dropped from the emitted array, never
 * invented as a guess; phases RC's own wire produced always round-trip via RC_PHASE_TO_PLACEMENT. */
const phaseToPlacement = (p: RegexPhase): RcPlacement | undefined => RC_PHASE_TO_PLACEMENT[p];

/** Known rule-level wire keys; anything else on a raw rule object is preserved in `extras`. */
const RC_RULE_KNOWN_KEYS = new Set([
  "id",
  "name",
  "description",
  "find_pattern",
  "replace_string",
  "placement",
  "flags",
  "enabled",
  "min_depth",
  "max_depth",
  "run_on_edit",
  "sort_order",
  "trim_strings",
]);

/** Read one subsystem-A rule off untrusted wire input. Tolerant: bad shapes fall back to safe defaults. */
function ruleToCanonical(raw: unknown): RegexRule {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const phases: RegexPhase[] = Array.isArray(r.placement) ? r.placement.map(placementToPhase) : [];

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (!RC_RULE_KNOWN_KEYS.has(k)) extras[k] = v;
  }

  const rule: RegexRule = {
    id: typeof r.id === "string" ? r.id : "",
    label: typeof r.name === "string" ? r.name : "",
    find: typeof r.find_pattern === "string" ? r.find_pattern : "",
    flags: typeof r.flags === "string" ? r.flags : "g",
    replace: typeof r.replace_string === "string" ? r.replace_string : "",
    phases,
    enabled: r.enabled !== false,
    sortOrder: typeof r.sort_order === "number" ? r.sort_order : 0,
  };
  if (typeof r.description === "string") rule.note = r.description;
  if (Array.isArray(r.trim_strings) && r.trim_strings.length > 0) {
    rule.trimStrings = r.trim_strings.filter((s): s is string => typeof s === "string");
  }
  if (typeof r.min_depth === "number") rule.minDepth = r.min_depth;
  else if (r.min_depth === null) rule.minDepth = null;
  if (typeof r.max_depth === "number") rule.maxDepth = r.max_depth;
  else if (r.max_depth === null) rule.maxDepth = null;
  if (typeof r.run_on_edit === "boolean") rule.runOnEdit = r.run_on_edit;
  if (Object.keys(extras).length > 0) rule.extras = extras;

  return rule;
}

/** Emit one canonical rule to subsystem A's wire shape. `raw` (the rule's original wire twin, if
 * any) seeds unknown-key preservation via `extras`; a from-scratch rule has none. */
function ruleToWire(rule: RegexRule): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    ...(rule.extras ?? {}),
    id: rule.id,
    name: rule.label,
    find_pattern: rule.find,
    replace_string: rule.replace,
    placement: rule.phases.map(phaseToPlacement).filter((p): p is RcPlacement => p !== undefined),
    flags: rule.flags,
    enabled: rule.enabled,
    sort_order: rule.sortOrder,
  };
  if (rule.note !== undefined) wire.description = rule.note;
  if (rule.trimStrings !== undefined) wire.trim_strings = rule.trimStrings;
  if (rule.minDepth !== undefined) wire.min_depth = rule.minDepth;
  if (rule.maxDepth !== undefined) wire.max_depth = rule.maxDepth;
  if (rule.runOnEdit !== undefined) wire.run_on_edit = rule.runOnEdit;
  return wire;
}

/** Read one subsystem-A `RegexScript` (a script IS a set: must #3, "script{rules[]} <-> one set"). */
export function rolecallRegexToCanonical(raw: unknown): RegexSetBody {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rules = Array.isArray(s.rules) ? s.rules.map(ruleToCanonical) : [];
  return {
    name: typeof s.name === "string" ? s.name : "",
    rules,
  };
}

/** Emit a canonical set back to subsystem A's `RegexScript` wire shape. `raw` is the original wire
 * script (when this body came from `rolecallRegexToCanonical`) - its `id` and any script-level keys
 * this codec does not model survive the round trip; omit for a from-scratch export. */
export function canonicalToRolecallRegex(
  body: RegexSetBody,
  raw?: unknown,
): Record<string, unknown> {
  const base = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  return {
    ...base,
    id: typeof base.id === "string" ? base.id : "",
    name: body.name,
    rules: body.rules.map(ruleToWire),
  };
}
