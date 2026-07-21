/**
 * RoleCall preset codec. RC exports the flat SillyTavern completion-preset grammar PLUS its own
 * top-level keys - the real fingerprint, read from a real export: `macro_engine_yaml` (the RC
 * macro engine's YAML, sealed data, never executed), `choice_groups` (the walkthrough the
 * canonical PresetChoice shape was distilled from), `readme`, `name`, `linkedRegexScripts` under
 * extensions on newer routes. A bare extensions.regex_scripts bundle is NOT a fingerprint -
 * SillyTavern presets bundle regex too (platform-owner correction).
 *
 * Mapping: shared st-preset wire for the ST half; name/readme/choice_groups map natively
 * (body.name / body.description / body.choices); macro_engine_yaml and every other RC key ride
 * the raw twin and re-emit untouched. Emit is twin-diff: RC keys are rewritten only when the
 * canonical value actually drifted, so an unedited import round-trips deep-equal.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type {
  CanonicalPreset,
  PresetBody,
  PresetChoice,
  PresetChoiceOption,
  PresetChoiceType,
} from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { buildStPreset } from "../_shared/st-preset-emit";
import {
  detectStPreset,
  isRec,
  parsedToBody,
  parseStPreset,
  type DividerDialect,
  type Rec,
} from "../_shared/st-preset-wire";
import { regexSetFromBundledRows } from "../sillytavern/regex";

const FORMAT_ID = "rolecall-preset";

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const toDialect = (v: unknown): DividerDialect => (v === "legacy" || v === "nemo-wiki" ? v : "none");

/** The RC fingerprint: any key only RoleCall's exporter writes onto the flat ST grammar. */
export function isRolecallPresetExport(json: unknown): json is Rec {
  if (!isRec(json) || !detectStPreset(json)) return false;
  if (typeof json.macro_engine_yaml === "string") return true;
  if (Array.isArray(json.choice_groups)) return true;
  const ext = json.extensions;
  return isRec(ext) && Array.isArray(ext.linkedRegexScripts);
}

const CHOICE_TYPES: readonly PresetChoiceType[] = ["one", "many", "toggle", "input"];

/** One wire choice_group -> canonical PresetChoice (the shape canonical was distilled FROM). */
function choiceFromWire(c: Rec): PresetChoice {
  const type = CHOICE_TYPES.includes(c.type as PresetChoiceType) ? (c.type as PresetChoiceType) : "one";
  const options: PresetChoiceOption[] = (Array.isArray(c.options) ? c.options : [])
    .filter(isRec)
    .map((o) => {
      const opt: PresetChoiceOption = { id: str(o.id) ?? "", label: str(o.label) ?? "" };
      const value = str(o.value);
      if (value !== undefined) opt.value = value;
      const desc = str(o.description);
      if (desc !== undefined) opt.description = desc;
      if (Array.isArray(o.prompts)) opt.enablesPrompts = o.prompts.filter((p): p is string => typeof p === "string");
      return opt;
    });
  const choice: PresetChoice = { id: str(c.id) ?? "", label: str(c.label) ?? "", type, options };
  const readme = str(c.description) ?? str(c.readme);
  if (readme !== undefined) choice.readme = readme;
  const key = str(c.key) ?? str(c.variableName);
  if (key !== undefined) choice.key = key;
  if (typeof c.default === "string" || typeof c.default === "boolean" || Array.isArray(c.default)) {
    choice.default = c.default as PresetChoice["default"];
  }
  const placeholder = str(c.placeholder);
  if (placeholder !== undefined) choice.placeholder = placeholder;
  if (Array.isArray(c.suggestions)) {
    choice.suggestions = c.suggestions.filter((s): s is string => typeof s === "string");
  }
  if (typeof c.min === "number") choice.min = c.min;
  const separator = str(c.separator);
  if (separator !== undefined) choice.separator = separator;
  if (typeof c.sortOrder === "number") choice.sortOrder = c.sortOrder;
  return choice;
}

/** Canonical choice -> wire choice_group (the inverse of choiceFromWire, sparse like the source). */
function choiceToWire(c: PresetChoice): Rec {
  const out: Rec = { id: c.id, label: c.label, type: c.type };
  if (c.readme !== undefined) out.description = c.readme;
  if (c.key !== undefined) out.key = c.key;
  if (c.default !== undefined) out.default = c.default;
  if (c.placeholder !== undefined) out.placeholder = c.placeholder;
  if (c.suggestions !== undefined) out.suggestions = c.suggestions;
  if (c.min !== undefined) out.min = c.min;
  if (c.separator !== undefined) out.separator = c.separator;
  if (c.sortOrder !== undefined) out.sortOrder = c.sortOrder;
  if (c.options.length > 0) {
    out.options = c.options.map((o) => {
      const w: Rec = { id: o.id, label: o.label };
      if (o.value !== undefined) w.value = o.value;
      if (o.description !== undefined) w.description = o.description;
      if (o.enablesPrompts !== undefined) w.prompts = o.enablesPrompts;
      return w;
    });
  }
  return out;
}

const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const rolecallPreset: PresetAdapter = {
  id: FORMAT_ID,
  label: "RoleCall preset export (ST grammar + macros/choice groups/readme)",
  outputExtensions: ["json"],
  kind: "preset",

  // 0.95: outranks the generic ST preset codec exactly like rolecall outranks sillytavern on cards.
  detect(input: AdapterInput): number {
    return isRolecallPresetExport(readJsonObject(input)) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const raw = readJsonObject(input);
    if (!raw || !isRolecallPresetExport(raw)) {
      throw new Error("rolecall-preset: not a RoleCall preset export (no RC fingerprint keys)");
    }
    const parsed = parseStPreset(raw);
    // RC exports carry the DISPLAY name on the wire; the filename is only the fallback
    const name = str(raw.name) ?? setNameFromFilename(input, "Imported preset");
    const body: PresetBody = parsedToBody(name, parsed);
    const readme = str(raw.readme);
    if (readme !== undefined) body.description = readme;
    const groups = Array.isArray(raw.choice_groups) ? raw.choice_groups.filter(isRec) : [];
    if (groups.length > 0) body.choices = groups.map(choiceFromWire);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body,
      original: {
        rolecall: {
          raw,
          unmapped: {
            dialect: parsed.dialect,
            ...(parsed.warnings.length > 0 ? { parseWarnings: parsed.warnings } : {}),
          },
        },
      },
    };
  },

  fromCanonical(entity: CanonicalPreset): AdapterOutput {
    const escrow = entity.original?.rolecall;
    const twin = isRec(escrow?.raw) ? (escrow.raw as Rec) : undefined;
    const out = buildStPreset(entity.body, twin, toDialect(escrow?.unmapped?.["dialect"]));
    // twin-diff on the RC-native keys: rewrite only what drifted, so an unedited import
    // re-emits its choice_groups / name / readme byte-identically off the clone
    const twinName = twin ? str(twin.name) : undefined;
    if (entity.body.name !== twinName) out.name = entity.body.name;
    const twinReadme = twin ? str(twin.readme) : undefined;
    if ((entity.body.description ?? undefined) !== twinReadme && entity.body.description !== undefined) {
      out.readme = entity.body.description;
    }
    const twinChoices = (Array.isArray(twin?.choice_groups) ? twin.choice_groups.filter(isRec) : []).map(choiceFromWire);
    const liveChoices = entity.body.choices ?? [];
    if (!deepEq(liveChoices, twinChoices)) out.choice_groups = liveChoices.map(choiceToWire);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },

  extractRegex(entity: CanonicalPreset): CanonicalRegexSet | null {
    const raw = entity.original?.rolecall?.raw;
    if (!isRec(raw) || !isRec(raw.extensions)) return null;
    return regexSetFromBundledRows(raw.extensions.regex_scripts, `${entity.body.name} regex`);
  },
};

export default rolecallPreset;
