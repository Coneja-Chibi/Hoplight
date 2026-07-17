/**
 * SillyTavern regex-script codec: reads/writes the ST `RegexScriptData[]` dialect into the
 * canonical regex entity (`entities/regex/schema.ts`) and back. Accepts BOTH homes per
 * REGEX-JEWEL-PLAN.md R1 must #1: a bare standalone array file (Marinara's Essentials packs ship
 * this form) and a character card's `extensions.regex_scripts` (v2 `data.extensions...` or a
 * flat `extensions...` object). Field map + int-enum decode verified against
 * `<downloads>/SillyTavern\public\scripts\extensions\regex\engine.js` (regex_placement,
 * substitute_find_regex, getRegexedString's markdownOnly/promptOnly fold) and `char-data.js`
 * (RegexScriptData shape).
 *
 * regexFromString (utils.js) residual, verified by reading the source (R1 must #1): the wrapper
 * parser `/(\/?)(.+)\1([a-z]*)/i` has an OPTIONAL leading-slash group, so a bare pattern with no
 * slashes (e.g. the "Format User's Stats" fixture row) matches with an EMPTY backreference,
 * the greedy `(.+)` swallows the whole string as the pattern, and flags come back empty - ST
 * compiles it as `new RegExp(pattern, "")`, no flags, case-sensitive. `parseFindWrapper` below
 * reuses that exact regex so this codec's split matches ST's own runtime, not a re-derivation.
 *
 * Lossless-escrow (R1 must #6): `RegexRule.extras` carries per-row leftovers the canonical model
 * does not first-class, PLUS one ST-only cosmetic marker (`extras["sillytavern.findWrapped"]`)
 * recording whether an empty-flags pattern arrived delimiter-wrapped (`/pattern/`) or bare
 * (`pattern`) - both decode to flags "", so without the marker a round-trip would silently
 * rewrite a wrapped-but-flagless pattern to bare form. Every other unrecognized row key is
 * spread into extras too and re-merged onto the wire untouched on export.
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

/** A single ST `RegexScriptData` row, as it appears on the wire. Tolerant: unknown keys allowed. */
interface StRegexRow {
  id?: unknown;
  scriptName?: unknown;
  findRegex?: unknown;
  replaceString?: unknown;
  trimStrings?: unknown;
  placement?: unknown;
  disabled?: unknown;
  markdownOnly?: unknown;
  promptOnly?: unknown;
  runOnEdit?: unknown;
  substituteRegex?: unknown;
  minDepth?: unknown;
  maxDepth?: unknown;
  [k: string]: unknown;
}

const KNOWN_ROW_KEYS = new Set([
  "id",
  "scriptName",
  "findRegex",
  "replaceString",
  "trimStrings",
  "placement",
  "disabled",
  "markdownOnly",
  "promptOnly",
  "runOnEdit",
  "substituteRegex",
  "minDepth",
  "maxDepth",
]);

const FIND_WRAP_MARKER = "sillytavern.findWrapped";

/** True if `v` looks like an ST regex row (tolerant shape check, not a full schema validation). */
function looksLikeStRegexRow(v: unknown): v is StRegexRow {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    ("findRegex" in v || "scriptName" in v || "replaceString" in v)
  );
}

/** Parse raw JSON text/bytes without the object-only restriction `readJsonObject` applies. */
const parseJson = readJsonAny;

/** Where a card's ST extensions object lives across the v1/v2 shapes we accept. */
function extensionsOf(obj: Record<string, unknown>): Record<string, unknown> | null {
  const data = obj.data;
  const nested = data && typeof data === "object" ? (data as Record<string, unknown>).extensions : undefined;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  const flat = obj.extensions;
  return flat && typeof flat === "object" ? (flat as Record<string, unknown>) : null;
}

type RowsSource = "file" | "card";

/** Read ST regex rows from either home. Tolerant: returns null on anything unrecognizable. */
function readRows(input: AdapterInput): { rows: StRegexRow[]; source: RowsSource } | null {
  const json = parseJson(input);
  if (Array.isArray(json)) {
    return json.length > 0 && json.every(looksLikeStRegexRow) ? { rows: json, source: "file" } : null;
  }
  if (json && typeof json === "object") {
    const ext = extensionsOf(json as Record<string, unknown>);
    const scripts = ext?.regex_scripts;
    if (Array.isArray(scripts) && scripts.length > 0 && scripts.every(looksLikeStRegexRow)) {
      return { rows: scripts, source: "card" };
    }
  }
  return null;
}

// -- findRegex <-> find/flags -------------------------------------------------------------------

/** ST's own wrapper split (utils.js `regexFromString`), reused verbatim so decode matches runtime. */
const ST_WRAPPER_RE = /(\/?)(.+)\1([a-z]*)/i;

/** Split ST's `findRegex` wire string into pattern text + flags text, exactly like ST compiles it. */
function parseFindWrapper(raw: string): { find: string; flags: string; wasWrapped: boolean } {
  const m = ST_WRAPPER_RE.exec(raw);
  if (!m) return { find: raw, flags: "", wasWrapped: false };
  return { find: m[2] ?? raw, flags: m[3] ?? "", wasWrapped: m[1] === "/" };
}

/** Inverse of parseFindWrapper: reconstruct ST's findRegex wire string. */
function encodeFindWrapper(find: string, flags: string, wasWrapped: boolean): string {
  if (flags) return `/${find}/${flags}`;
  return wasWrapped ? `/${find}/` : find;
}

// -- placement <-> phases + targets --------------------------------------------------------------

const PHASE_BY_PLACEMENT: Record<number, RegexPhase> = {
  1: "input",
  2: "output",
  3: "slash",
  5: "lorebook",
  6: "reasoning",
};
const PLACEMENT_BY_PHASE: Partial<Record<RegexPhase, number>> = {
  input: 1,
  output: 2,
  slash: 3,
  lorebook: 5,
  reasoning: 6,
};

/** Split ST's numeric placement[] into canonical phases + any numbers this codec does not know
 * (kept in extras so an exotic/future placement value survives the round-trip). */
function phasesFromPlacement(placement: number[]): { phases: RegexPhase[]; unmapped: number[] } {
  const phases: RegexPhase[] = [];
  const unmapped: number[] = [];
  for (const n of placement) {
    const phase = PHASE_BY_PLACEMENT[n];
    if (phase) {
      if (!phases.includes(phase)) phases.push(phase);
    } else if (!unmapped.includes(n)) {
      unmapped.push(n);
    }
  }
  return { phases, unmapped };
}

function placementFromPhases(phases: RegexPhase[], unmapped: number[]): number[] {
  const nums = phases.map((p) => PLACEMENT_BY_PHASE[p]).filter((n): n is number => n != null);
  return [...new Set([...nums, ...unmapped])];
}

/** getRegexedString's markdownOnly/promptOnly fold (engine.js) onto the canonical target axis. */
function targetsFromFlags(markdownOnly: boolean, promptOnly: boolean): RegexTargetChannel[] | undefined {
  const targets: RegexTargetChannel[] = [];
  if (markdownOnly) targets.push("display");
  if (promptOnly) targets.push("prompt");
  return targets.length > 0 ? targets : undefined;
}

// -- substituteRegex <-> substituteFind -----------------------------------------------------------

function substituteFindFromNumber(n: unknown): RegexSubstitution | undefined {
  if (n === 1) return "raw";
  if (n === 2) return "escaped";
  return undefined; // 0 or absent - "none" is the schema's implicit default
}

function substituteRegexNumber(mode: RegexSubstitution | undefined): number {
  if (mode === "raw") return 1;
  if (mode === "escaped") return 2;
  return 0;
}

// -- row <-> rule -----------------------------------------------------------------------------

function rowToRule(row: StRegexRow, index: number): RegexRule {
  const { find, flags, wasWrapped } = parseFindWrapper(
    typeof row.findRegex === "string" ? row.findRegex : "",
  );
  const placement = Array.isArray(row.placement)
    ? row.placement.filter((n): n is number => typeof n === "number")
    : [];
  const { phases, unmapped } = phasesFromPlacement(placement);
  const trimStrings = Array.isArray(row.trimStrings)
    ? row.trimStrings.filter((s): s is string => typeof s === "string")
    : undefined;

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!KNOWN_ROW_KEYS.has(k)) extras[k] = v;
  }
  extras[FIND_WRAP_MARKER] = wasWrapped;
  if (unmapped.length > 0) extras["sillytavern.unmappedPlacements"] = unmapped;

  return {
    id: row.id != null ? String(row.id) : String(index),
    label: typeof row.scriptName === "string" && row.scriptName ? row.scriptName : `Rule ${index + 1}`,
    find,
    flags,
    replace: typeof row.replaceString === "string" ? row.replaceString : "",
    trimStrings,
    phases,
    targets: targetsFromFlags(row.markdownOnly === true, row.promptOnly === true),
    substituteFind: substituteFindFromNumber(row.substituteRegex),
    minDepth: typeof row.minDepth === "number" ? row.minDepth : null,
    maxDepth: typeof row.maxDepth === "number" ? row.maxDepth : null,
    runOnEdit: typeof row.runOnEdit === "boolean" ? row.runOnEdit : undefined,
    enabled: row.disabled !== true,
    sortOrder: index,
    extras: Object.keys(extras).length > 0 ? extras : undefined,
  };
}

function ruleToRow(rule: RegexRule): StRegexRow {
  const { [FIND_WRAP_MARKER]: wrapMarker, "sillytavern.unmappedPlacements": unmappedRaw, ...restExtras } =
    rule.extras ?? {};
  const wasWrapped = wrapMarker === true;
  const unmapped = Array.isArray(unmappedRaw) ? unmappedRaw.filter((n): n is number => typeof n === "number") : [];

  return {
    ...restExtras,
    id: rule.id,
    scriptName: rule.label,
    findRegex: encodeFindWrapper(rule.find, rule.flags, wasWrapped),
    replaceString: rule.replace,
    trimStrings: rule.trimStrings ?? [],
    placement: placementFromPhases(rule.phases as RegexPhase[], unmapped),
    disabled: !rule.enabled,
    markdownOnly: (rule.targets ?? []).includes("display"),
    promptOnly: (rule.targets ?? []).includes("prompt"),
    runOnEdit: rule.runOnEdit ?? true,
    substituteRegex: substituteRegexNumber(rule.substituteFind),
    minDepth: rule.minDepth ?? null,
    maxDepth: rule.maxDepth ?? null,
  };
}

// -- set name (ST has no container name; derive from the file or fall back) -----------------------

function deriveSetName(input: AdapterInput, source: RowsSource): string {
  return setNameFromFilename(
    input,
    source === "card" ? "Character regex scripts" : "Imported regex scripts",
  );
}

// -- adapter shape (a RegexAdapter; registered via sillytavern/index.ts's family array) -----------

const sillytavernRegex: RegexAdapter = {
  id: "sillytavern-regex",
  label: "SillyTavern regex scripts (bare array or card extensions.regex_scripts)",
  outputExtensions: ["json"],
  kind: "regex",

  detect(input: AdapterInput): number {
    const found = readRows(input);
    if (!found) return 0;
    return found.source === "file" ? 0.9 : 0.85;
  },

  toCanonical(input: AdapterInput): CanonicalRegexSet {
    const found = readRows(input);
    if (!found) throw new Error("sillytavern-regex: not a recognizable ST regex script set");
    const body: RegexSetBody = {
      name: deriveSetName(input, found.source),
      rules: found.rows.map(rowToRule),
    };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "regex",
      id: canonicalId(body.name),
      body,
      original: { "sillytavern-regex": { raw: found.rows } },
    };
  },

  fromCanonical(entity: CanonicalRegexSet): AdapterOutput {
    const rows = entity.body.rules.map(ruleToRow);
    return { text: JSON.stringify(rows, null, 2), suggestedExtension: "json" };
  },
};

export default sillytavernRegex;
