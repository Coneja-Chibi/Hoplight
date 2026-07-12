/**
 * Risu regex codec: `customscript` rows (card `customScripts` AND module `regex[]` - same row
 * shape per RisuAI's `customscript` type) <-> canonical. Two shapes live here:
 *
 * 1. The narrow card-embedded twin (`readRegexScripts`/`regexScriptsToWire`, moved here verbatim
 *    from `risu-fields.ts` and re-exported so the character codec keeps working unchanged) -
 *    singular `phase`, no id/enabled/sortOrder, matches `CharacterBehavior.regexScripts`.
 * 2. The full standalone-entity mapping (`regexRowsToRules`/`rulesToRegexRows`) used by the regex
 *    entity (REGEX-JEWEL-PLAN.md R1): array phase, id, enabled, sortOrder, extras.
 *
 * Field map per design/REGEX-FORMATS.md "RisuAI" section: `in/out/type/flag/ableFlag/disabled`.
 * `disabled` is read tolerantly (reflex 13): only literal `true` counts as off; a malformed value
 * observed live (`"disabled":""`) is treated as enabled, never thrown on.
 *
 * R1 residual - omitted `type` default: RisuAI source (`_reference/RisuAI/src/ts/process/
 * scripts.ts`) declares `customscript.type: string` (REQUIRED, no default) and dispatches with
 * strict equality (`if(script.type === mode)`), so an omitted/undefined type matches NO pipeline
 * mode and the rule effectively never runs. There is no invented default here: an omitted `type`
 * decodes to an EMPTY `phases` array, and re-exporting an unedited rule leaves the `type` key
 * untouched (twin-overlay below), never fabricating one.
 *
 * R1 residual - `editrequest` vs `editprocess`: design/REGEX-FORMATS.md (survey) states the wire
 * value is `editrequest`; the current RisuAI source's `ScriptMode` union is
 * `editinput|editoutput|editprocess|editdisplay` (`editprocess` = "modifies the text before
 * sending the HTTP request" per `mcp/risuaccess/client.ts`) and has NO `editrequest` member. Both
 * spellings were observed live on real `.risum` modules in this survey's own fixtures - reality
 * disagrees with the doc on the CURRENT name, not the phase. Both map to canonical phase
 * "request"; the twin-overlay write path preserves whichever spelling was on the wire for an
 * unedited rule, and writes the current source-confirmed `editprocess` only for a freshly-set
 * "request" phase (never fabricates the deprecated `editrequest` spelling).
 *
 * `flag` can carry Risu extension tokens (e.g. `"gu<cbs>"`) - stored verbatim, never parsed or
 * passed to `new RegExp` here (compile-time stripping is the R2 engine's job, not the codec's).
 */
import type { RegexScript } from "../../entities/character/schema";
import type { CanonicalRegexSet, RegexPhase, RegexRule, RegexSetBody } from "../../entities/regex/schema";
import type { AdapterInput, AdapterOutput, RegexAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonAny } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { openRisumModule } from "./open-module";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// -- narrow card-embedded twin (moved verbatim from risu-fields.ts) --------------------------------

/** customScripts wire rows -> RegexScript[] (undefined when none). */
export function readRegexScripts(v: unknown): RegexScript[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRec).map((s): RegexScript => {
    const r: RegexScript = {
      find: typeof s.in === "string" ? s.in : "",
      replace: typeof s.out === "string" ? s.out : "",
      phase: typeof s.type === "string" ? s.type : "",
    };
    if (typeof s.comment === "string") r.label = s.comment;
    if (typeof s.flag === "string") r.flags = s.flag;
    if (typeof s.ableFlag === "boolean") r.useFlags = s.ableFlag;
    return r;
  });
  return out.length > 0 ? out : undefined;
}

export const regexScriptsToWire = (list: RegexScript[]): Rec[] =>
  list.map((r) => ({
    comment: r.label ?? "",
    in: r.find,
    out: r.replace,
    type: r.phase,
    ...(r.flags !== undefined ? { flag: r.flags } : {}),
    ...(r.useFlags !== undefined ? { ableFlag: r.useFlags } : {}),
  }));

// -- full standalone regex entity mapping -----------------------------------------------------------

/** One Risu `customscript` row (card `customScripts[]` or module `regex[]` - identical shape). */
export interface RisuRegexRow {
  comment?: string;
  in?: string;
  out?: string;
  type?: string;
  flag?: string;
  ableFlag?: boolean;
  disabled?: boolean;
  [key: string]: unknown;
}

const KNOWN_ROW_KEYS = new Set(["comment", "in", "out", "type", "flag", "ableFlag", "disabled"]);

/** Wire type -> canonical phase. Both `editrequest` (survey-observed) and `editprocess` (current
 * RisuAI source) mean the same pipeline stage - see the R1 residual note above. */
const RISU_TYPE_TO_PHASE: Record<string, RegexPhase> = {
  editinput: "input",
  editoutput: "output",
  editdisplay: "display",
  editrequest: "request",
  editprocess: "request",
};

/** Canonical phase -> wire type for a FRESH write (no twin to preserve spelling from). Uses the
 * current RisuAI source's `editprocess`, never the deprecated `editrequest` spelling. */
const PHASE_TO_RISU_TYPE: Record<string, string> = {
  input: "editinput",
  output: "editoutput",
  display: "editdisplay",
  request: "editprocess",
};

/** Decode one wire row into a canonical rule. `index` becomes the id/sortOrder (Risu rows carry
 * no id of their own - the lorebook codec's same `String(index)` fallback precedent). */
function rowToRule(row: RisuRegexRow, index: number): RegexRule {
  const rawType = typeof row.type === "string" ? row.type : undefined;
  const phase = rawType !== undefined ? (RISU_TYPE_TO_PHASE[rawType] ?? rawType) : undefined;

  const extras: Rec = {};
  for (const [k, v] of Object.entries(row)) {
    if (!KNOWN_ROW_KEYS.has(k)) extras[k] = v;
  }

  const rule: RegexRule = {
    id: String(index),
    label: typeof row.comment === "string" ? row.comment : "",
    find: typeof row.in === "string" ? row.in : "",
    flags: typeof row.flag === "string" ? row.flag : "",
    replace: typeof row.out === "string" ? row.out : "",
    phases: phase !== undefined ? [phase] : [],
    enabled: row.disabled !== true, // tolerant: only literal true is "off" (reflex 13)
    sortOrder: index,
  };
  if (typeof row.ableFlag === "boolean") rule.useFlags = row.ableFlag;
  if (Object.keys(extras).length > 0) rule.extras = extras;
  return rule;
}

/**
 * Re-encode one canonical rule into a wire row. With a twin (same-format round-trip), overlay
 * onto its clone and rewrite ONLY fields whose canonical value changed vs what that twin decodes
 * to, so an unedited rule re-emits byte-for-byte (an absent `flag`/`disabled` key stays absent, a
 * present-empty one stays present-empty, `editrequest` stays `editrequest`). Mirrors
 * `risu/lorebook.ts`'s `entryToWire`.
 */
function ruleToRow(rule: RegexRule, twin: RisuRegexRow | undefined, index: number): RisuRegexRow {
  const base: RisuRegexRow = twin ? (structuredClone(twin) as RisuRegexRow) : {};
  const decoded = twin ? rowToRule(twin, index) : null;
  const changed = (field: keyof RegexRule): boolean => !decoded || !deepEq(rule[field], decoded[field]);

  if (changed("label")) base.comment = rule.label;
  if (changed("find")) base.in = rule.find;
  if (changed("replace")) base.out = rule.replace;
  if (changed("phases")) {
    const phase = rule.phases[0];
    if (phase === undefined) delete base.type;
    else base.type = PHASE_TO_RISU_TYPE[phase] ?? phase;
  }
  if (changed("flags")) {
    if (rule.flags) base.flag = rule.flags;
    else delete base.flag;
  }
  if (changed("useFlags")) {
    if (rule.useFlags !== undefined) base.ableFlag = rule.useFlags;
    else delete base.ableFlag;
  }
  if (changed("enabled")) {
    if (rule.enabled) delete base.disabled;
    else base.disabled = true;
  }
  if (changed("extras")) {
    for (const [k, v] of Object.entries(rule.extras ?? {})) base[k] = v;
  }
  return base;
}

/** Decode a Risu `customscript`/`regex[]` array into canonical rules (empty array on bad input). */
export function regexRowsToRules(rows: unknown): RegexRule[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isRec).map((r, i) => rowToRule(r as RisuRegexRow, i));
}

/**
 * Re-encode canonical rules against an original wire array, id-matched (id = original row index,
 * per `rowToRule`). Twin rows walk in ORIGINAL order so an unedited file stays byte-identical;
 * rules with no twin (fresh additions) append; twin rows whose rule was deleted drop out. Mirrors
 * `risu/lorebook.ts`'s `bookToWire` walk.
 */
export function rulesToRegexRows(rules: RegexRule[], twinRows: unknown): RisuRegexRow[] {
  const twins = Array.isArray(twinRows) ? (twinRows.filter(isRec) as RisuRegexRow[]) : [];
  const byId = new Map(rules.map((r) => [r.id, r] as const));
  const used = new Set<string>();
  const out: RisuRegexRow[] = [];

  twins.forEach((twin, i) => {
    const rid = String(i);
    const rule = byId.get(rid);
    if (!rule) return; // deleted canonically
    used.add(rid);
    out.push(ruleToRow(rule, twin, i));
  });
  for (const rule of rules) {
    if (used.has(rule.id)) continue;
    out.push(ruleToRow(rule, undefined, out.length));
  }
  return out;
}

// -- adapter shell (registered via risu/index.ts's family array) -----------------------------------

/**
 * Two real file homes converge on the standalone-entity mapping above:
 * 1. A `.risum` module blob whose decoded `regex[]` is non-empty (openRisumModule; the bare-module
 *    home - `.charx` zips stay the character adapter's, which scores 1.0 on them, and a zip is
 *    never a valid RPack so this detect returns 0 there by construction).
 * 2. A bare JSON array of `customscript` rows (`in`/`out` plus at least one of type/comment/flag/
 *    ableFlag/disabled somewhere) - the module-source form. Key-disjoint from ST rows
 *    (findRegex/scriptName) and Marinara rows (findRegex/name), so no cross-adapter bid.
 *
 * EXPORT IS ROWS-ONLY: fromCanonical emits the pretty-JSON row array, never a re-packed `.risum` -
 * a module carries triggers/lorebook/assets this entity has no home for, and inventing a module
 * wrapper around bare rows would fabricate wire data. Re-packing whole modules is the future module
 * entity's job (see docs/RISU-WORKSHOP-PLAN.md), not this shell's.
 */
function looksLikeRisuRegexRow(v: unknown): v is RisuRegexRow {
  return isRec(v) && (typeof v.in === "string" || typeof v.out === "string");
}

function hasRisuRowSignal(rows: readonly RisuRegexRow[]): boolean {
  return rows.some(
    (r) => "type" in r || "comment" in r || "flag" in r || "ableFlag" in r || "disabled" in r,
  );
}

interface FoundRisuRows {
  rows: RisuRegexRow[];
  home: "risum" | "rows-file";
  moduleName?: string;
}

/** Read rows from either home. Tolerant: null on anything unrecognizable. */
function readRisuRows(input: AdapterInput): FoundRisuRows | null {
  if (input.bytes) {
    const opened = openRisumModule(input.bytes);
    const rows = opened?.module.regex;
    if (Array.isArray(rows) && rows.length > 0) {
      return { rows: rows as RisuRegexRow[], home: "risum", moduleName: opened?.name };
    }
  }
  const json = readJsonAny(input);
  if (Array.isArray(json) && json.length > 0 && json.every(looksLikeRisuRegexRow)) {
    const rows = json as RisuRegexRow[];
    return hasRisuRowSignal(rows) ? { rows, home: "rows-file" } : null;
  }
  return null;
}

export const regexAdapter: RegexAdapter = {
  id: "risu-regex",
  label: "RisuAI regex scripts (.risum module or customscript array)",
  outputExtensions: ["json"],
  kind: "regex",

  detect(input: AdapterInput): number {
    const found = readRisuRows(input);
    if (!found) return 0;
    return found.home === "risum" ? 0.8 : 0.85;
  },

  toCanonical(input: AdapterInput): CanonicalRegexSet {
    const found = readRisuRows(input);
    if (!found) throw new Error("risu-regex: not a recognizable Risu regex script set");
    const body: RegexSetBody = {
      name: found.moduleName ?? setNameFromFilename(input, "Imported regex scripts"),
      rules: regexRowsToRules(found.rows),
    };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "regex",
      id: canonicalId(body.name),
      body,
      original: { "risu-regex": { raw: found.rows } },
    };
  },

  fromCanonical(entity: CanonicalRegexSet): AdapterOutput {
    const twin = entity.original?.["risu-regex"]?.raw;
    const rows = rulesToRegexRows(entity.body.rules, twin);
    return { text: JSON.stringify(rows, null, 2), suggestedExtension: "json" };
  },
};
