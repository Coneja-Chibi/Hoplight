/**
 * RoleCall preset codec. RC's export writes the SAME flat SillyTavern completion-preset grammar
 * (specs/formats/st-preset.md) - the distinguishing mark is the BUNDLE: RC's export routes attach
 * regex under extensions.regex_scripts (newer ones add extensions.linkedRegexScripts), which
 * vanilla ST preset exports never carry. A bundled flat preset is therefore an RC export by
 * construction and deserves its own identity ("A preset, made for RoleCall."), not a parenthetical
 * on the ST codec. Wire logic is the shared _shared/st-preset-wire pair; only the identity,
 * escrow key, and claim strength live here.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type { CanonicalPreset } from "../../entities/preset/schema";
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

const toDialect = (v: unknown): DividerDialect => (v === "legacy" || v === "nemo-wiki" ? v : "none");

/** The RC fingerprint: a flat ST-grammar preset whose extensions carry a regex bundle. */
export function isRolecallPresetExport(json: unknown): json is Rec {
  if (!isRec(json) || !detectStPreset(json)) return false;
  const ext = json.extensions;
  if (!isRec(ext)) return false;
  return Array.isArray(ext.regex_scripts) || Array.isArray(ext.linkedRegexScripts);
}

const rolecallPreset: PresetAdapter = {
  id: FORMAT_ID,
  label: "RoleCall preset export (ST-compatible flat json, bundles regex)",
  outputExtensions: ["json"],
  kind: "preset",

  // 0.95: outranks the generic ST preset codec's 0.9 exactly like rolecall outranks sillytavern
  // on cards - the more specific claimant wins when its fingerprint is present.
  detect(input: AdapterInput): number {
    return isRolecallPresetExport(readJsonObject(input)) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const raw = readJsonObject(input);
    if (!raw || !isRolecallPresetExport(raw)) {
      throw new Error("rolecall-preset: not a RoleCall preset export (no bundled regex fingerprint)");
    }
    const parsed = parseStPreset(raw);
    const name = setNameFromFilename(input, "Imported preset");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body: parsedToBody(name, parsed),
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
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },

  extractRegex(entity: CanonicalPreset): CanonicalRegexSet | null {
    const raw = entity.original?.rolecall?.raw;
    if (!isRec(raw) || !isRec(raw.extensions)) return null;
    return regexSetFromBundledRows(raw.extensions.regex_scripts, `${entity.body.name} regex`);
  },
};

export default rolecallPreset;
