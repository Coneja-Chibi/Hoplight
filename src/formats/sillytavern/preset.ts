/**
 * SillyTavern completion-preset codec (specs/formats/st-preset.md). This is also RoleCall's preset
 * wire format: RC exports write the same flat grammar, optionally bundling regex under
 * `extensions.regex_scripts` (+ RC's own `linkedRegexScripts`), so one codec imports both.
 * Lossless: the whole source file rides as the raw twin in original.sillytavern; emit clones the
 * twin and rebuilds only what canonical owns (preset-emit.ts). Bundled regex surfaces through
 * extractRegex, the preset counterpart of the character adapter's extractLorebook seam.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type { CanonicalPreset } from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { detectStPreset, isRec, parsedToBody, parseStPreset, type DividerDialect, type Rec } from "./preset-wire";
import { buildStPreset } from "./preset-emit";
import { regexSetFromBundledRows } from "./regex";

const FORMAT_ID = "sillytavern-preset";

const toDialect = (v: unknown): DividerDialect =>
  v === "legacy" || v === "nemo-wiki" ? v : "none";

const presetAdapter: PresetAdapter = {
  id: FORMAT_ID,
  label: "SillyTavern completion preset (flat json; RoleCall preset exports too)",
  outputExtensions: ["json"],
  kind: "preset",
  // coverage: deliberately undeclared until the claims harness audits it (deny-by-absence honest;
  // the marinara preset codec takes the same posture)

  // 0.9: above the regex codec's card-home 0.85 (a preset that bundles regex is still a preset)
  // and level with the character reader, which refuses settings exports outright.
  detect(input: AdapterInput): number {
    return detectStPreset(readJsonObject(input)) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const raw = readJsonObject(input);
    if (!raw || !detectStPreset(raw)) {
      throw new Error("sillytavern-preset: not a recognizable completion preset");
    }
    const parsed = parseStPreset(raw);
    // ST preset files carry no name field; the filename is the name every host shows
    const name = setNameFromFilename(input, "Imported preset");
    const body = parsedToBody(name, parsed);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body,
      original: {
        sillytavern: {
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
    const escrow = entity.original?.sillytavern;
    const twin = isRec(escrow?.raw) ? (escrow.raw as Rec) : undefined;
    const dialect = toDialect(escrow?.unmapped?.["dialect"]);
    const out = buildStPreset(entity.body, twin, dialect);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },

  extractRegex(entity: CanonicalPreset): CanonicalRegexSet | null {
    const raw = entity.original?.sillytavern?.raw;
    if (!isRec(raw) || !isRec(raw.extensions)) return null;
    return regexSetFromBundledRows(raw.extensions.regex_scripts, `${entity.body.name} regex`);
  },
};

export default presetAdapter;
export { presetAdapter };
