/**
 * Marinara-Engine format family: regex scripts, persona, the native lorebook envelope
 * (lorebook.ts), and the prompt-preset codec (preset.ts, named export). The character-side
 * Marinara dialect stays where it lives (the generic extensions bag via
 * `_shared/extension-platforms.ts`).
 *
 * File home: a bare JSON array of `MarinaraRegexScript` rows - the shape Marinara-Engine's own API
 * serves (`GET /regex-scripts` in `packages/server/src/routes/regex-scripts.routes.ts` returns
 * `storage.list()`, verified 2026-07-11). Marinara has NO file import/export UI of its own, so an
 * API dump is the only standalone file form that exists in reality; this adapter reads and writes
 * that shape and invents no envelope around it.
 *
 * DETECTION FIREWALL (load-bearing): Marinara rows carry `findRegex`/`replaceString`, which ALSO
 * satisfies the SillyTavern regex codec's row check, so ST bids 0.9 on a Marinara dump. This
 * adapter therefore (a) hard-refuses anything with an ST `scriptName` key, (b) requires a
 * Marinara-distinct signal somewhere (`targetCharacterIds` / `order` / string placement values -
 * ST placement is numeric), and (c) outbids ST at 0.95 when both match. The inverse is safe by
 * construction: real ST rows always carry `scriptName`, so this adapter scores 0 on them
 * (regression-pinned against the ST-form `_fixtures/regex/marinara-essentials.json`, which despite
 * the name is an ST-dialect pack).
 */
import type {
  CanonicalRegexSet,
  RegexSetBody,
} from "../../entities/regex/schema";
import type { AdapterInput, AdapterOutput, RegexAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonAny } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import {
  marinaraScriptsToRules,
  readMarinaraRegexScript,
  rulesToMarinaraScripts,
} from "../_shared/marinara-regex";
import personaAdapter from "./persona";
import marinaraPreset from "./preset";
import marinaraLorebook from "./lorebook";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** True when a row carries a field only Marinara's wire has (see the detection firewall above). */
function hasMarinaraSignal(row: Record<string, unknown>): boolean {
  if ("targetCharacterIds" in row || "order" in row) return true;
  return (
    Array.isArray(row.placement) &&
    row.placement.some((p) => p === "ai_output" || p === "user_input")
  );
}

/** Read a Marinara script dump. Tolerant: null on anything that is not one. */
function readMarinaraRows(input: AdapterInput): Record<string, unknown>[] | null {
  const json = readJsonAny(input);
  if (!Array.isArray(json) || json.length === 0) return null;
  const rows = json.filter(isRec);
  if (rows.length !== json.length) return null;
  if (rows.some((r) => "scriptName" in r)) return null; // ST dialect, not ours
  if (!rows.every((r) => readMarinaraRegexScript(r) !== null)) return null;
  if (!rows.some(hasMarinaraSignal)) return null;
  return rows;
}

const regexAdapter: RegexAdapter = {
  id: "marinara-regex",
  label: "Marinara-Engine regex scripts (API dump array)",
  outputExtensions: ["json"],
  kind: "regex",

  // 0.95: must outbid SillyTavern's 0.9 bid on the shared findRegex/replaceString keys once the
  // Marinara-distinct gates above have passed.
  detect(input: AdapterInput): number {
    return readMarinaraRows(input) ? 0.95 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalRegexSet {
    const rows = readMarinaraRows(input);
    if (!rows) throw new Error("marinara-regex: not a recognizable Marinara regex script dump");
    const body: RegexSetBody = {
      name: setNameFromFilename(input, "Imported regex scripts"),
      rules: marinaraScriptsToRules(rows),
    };
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "regex",
      id: canonicalId(body.name),
      body,
      original: { "marinara-regex": { raw: rows } },
    };
  },

  fromCanonical(entity: CanonicalRegexSet): AdapterOutput {
    const rows = rulesToMarinaraScripts(entity.body.rules);
    return { text: JSON.stringify(rows, null, 2), suggestedExtension: "json" };
  },
};

export { regexAdapter };

/**
 * The prompt-preset codec (kind "preset") is a NAMED export, not part of the loader-discovered
 * default array below. The registry's `FormatAdapter` union (src/core/adapter.ts) has no preset
 * member yet, so the generated static registrar (src/generated/packaged-formats.ts) cannot accept a
 * preset-kind object; the preset layer imports this directly. Add a `PresetAdapter` member to that
 * union to make it loader-discoverable.
 */
export { marinaraPreset };

/** Folders-as-schema: the Marinara family codecs (regex scripts + persona + native lorebook). */
export default [regexAdapter, personaAdapter, marinaraLorebook];
