/**
 * The regex slice (spec Behavior step 5, regex row; step 6 for scope resolution; step 7 for
 * isolation). A `regex_scripts` row is close to `LumiverseRegexScriptWire` (the FULL account-scope
 * shape the codec already parses, `target` as an array; NOT the reduced module-embedded shape a
 * character archive's own `lumiverse_modules.json` carries, whose `target` is a single string, see
 * src/formats/lumiverse/regex.ts's own doc comment). Rows don't dispatch one at a time: Lumiverse
 * scopes a rule to the whole account, to one character, or to one preset (`scope`/`scope_id`), and
 * every rule sharing a scope becomes ONE canonical set, matching how the standalone export file
 * itself groups scripts (one file, `scripts: []`, per scope) rather than one file per rule.
 *
 * `LumiverseRegexScriptWire` has no `character_id` field at all (verified against the codec's own
 * type: only `preset_id` gets a dedicated slot). `scope_id` is therefore the one honest, general
 * cross-reference, for both character- and preset-scoped rows; `character_id` survives only through
 * the raw-row escrow, never on the synthesized wire.
 *
 * The codec's own file has no name of its own (`body.name = setNameFromFilename(...)`, never a wire
 * field), so the filename this module hands it IS the set's name: the resolved scope target's name
 * for a scoped set, a stable neutral name for the account bucket. The resolved target's Hoplight id
 * has nowhere honest to live on RegexSetBody (no cross-reference field exists there), so it rides
 * the archive escrow's own `unmapped.links`, never the codec's twin (the M4 principle: resolution is
 * an import-time fact about this archive, not something to inject into what the codec itself parsed).
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { regexAdapter } from "../lumiverse/regex";
import { addArchiveEscrow } from "./escrow";
import type { LinkMap } from "./links";
import {
  codecRowFailure,
  recordFailure,
  recordImported,
  type LvbakImportReport,
  type LvbakRowFailure,
} from "./report";
import type { LvbakEntrySource } from "./source";
import { innerJsonRowFailure, readTable, type ReadTableOptions, type TableRow } from "./table-walk";
import type { InnerJsonResult } from "./tables";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Build the wire shape `LumiverseRegexScriptWire` already parses. `run_on_edit`/`disabled` are
 * coerced from SQLite's 0/1 to real booleans: the wire's own type declares them boolean and the
 * codec's decode assigns `run_on_edit` straight through with no coercion of its own, so a bare 0/1
 * would ride onto the canonical rule as a number, not the false/true it means.
 */
export function regexRowToScript(row: Record<string, unknown>, inner: InnerJsonResult): Record<string, unknown> {
  return {
    id: row.id,
    name: asString(row.name),
    script_id: row.script_id,
    find_regex: asString(row.find_regex),
    replace_string: asString(row.replace_string),
    actions: inner.values.actions,
    flags: asString(row.flags),
    placement: asStringArray(inner.values.placement),
    scope: row.scope,
    scope_id: row.scope_id,
    target: asStringArray(inner.values.target),
    min_depth: row.min_depth,
    max_depth: row.max_depth,
    trim_strings: asStringArray(inner.values.trim_strings),
    run_on_edit: row.run_on_edit === 1,
    substitute_macros: row.substitute_macros,
    disabled: row.disabled === 1,
    sort_order: row.sort_order,
    description: asString(row.description),
    folder: row.folder,
    pack_id: row.pack_id,
    preset_id: row.preset_id,
    metadata: inner.values.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export type RegexScope = "account" | "character" | "preset";

export interface RegexRowGroup {
  scope: RegexScope;
  /** null for the account bucket; the Lumiverse id of the target for a scoped group. */
  scopeId: string | null;
  rows: TableRow[];
}

/**
 * Bucket rows by scope, preserving first-seen order across groups. Only `scope === "character"` or
 * `"preset"` with a real string `scope_id` produce a scoped bucket; everything else (`"account"`, no
 * scope at all, or any other/unrecognized value, such as a pack scope this archive never maps) falls
 * into the single account-wide bucket rather than being dropped. No evidence in any fixture or spec
 * text names a fourth scope value, so this is a conservative default, not a confirmed mapping.
 */
export function groupRegexRows(rows: readonly TableRow[]): RegexRowGroup[] {
  const buckets = new Map<string, RegexRowGroup>();
  const order: string[] = [];

  for (const read of rows) {
    const row = read.row;
    const scopeId = typeof row.scope_id === "string" && row.scope_id ? row.scope_id : null;
    const scope: RegexScope =
      row.scope === "character" && scopeId ? "character" : row.scope === "preset" && scopeId ? "preset" : "account";
    const key = scope === "account" ? "account" : `${scope}:${scopeId}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { scope, scopeId: scope === "account" ? null : scopeId, rows: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.rows.push(read);
  }

  return order.map((key) => buckets.get(key)!);
}

/** The three columns actually consumed for functional (first-class) canonical fields: placement ->
 * phases, target -> targets, trim_strings -> trimStrings. `actions` and `metadata` also parse into
 * `rule.extras`, but extras is documented across this codebase as a sealed, never-executed leftovers
 * bag (regex.ts's own comment: actions are "carried via extras and replayed untouched"), so losing
 * one is cosmetic, not the same class of loss as losing the rule's own trigger/replacement shape. */
const GATING_COLUMNS = new Set(["placement", "target", "trim_strings"]);

function regexGatingFailure(read: TableRow): LvbakRowFailure | null {
  if (!read.inner.failures.some((f) => GATING_COLUMNS.has(f.column))) return null;
  return innerJsonRowFailure("regex_scripts", read);
}

export interface ImportRegexSetsOptions {
  lineCeiling: number;
  report: LvbakImportReport;
  links: LinkMap;
}

/**
 * Import every regex set: gate and group the rows, synthesize and dispatch one file per scope,
 * resolve a scoped set's target through the link map (a dangling scope still imports, named from
 * its raw id, with the miss recorded by resolve() itself), and escrow every row the set came from.
 * No links.record: nothing downstream ever links to a regex set. A codec-level (or any other
 * unexpected) throw during synthesis/dispatch/resolution fails the whole GROUP (there is no smaller
 * unit to dispatch than one file per scope): recorded as one failure per row in that group, the
 * stream continues to the next scope.
 */
export async function importRegexSets(
  source: LvbakEntrySource,
  options: ImportRegexSetsOptions,
): Promise<ParsedCanonicalEntity[]> {
  const { lineCeiling, report, links } = options;
  const opts: ReadTableOptions = {
    lineCeiling,
    onFailure: (failure) => recordFailure(report, failure),
  };

  const valid: TableRow[] = [];
  for await (const read of readTable(source, "regex_scripts", opts)) {
    const gating = regexGatingFailure(read);
    if (gating) {
      recordFailure(report, gating);
      continue;
    }
    valid.push(read);
  }

  const out: ParsedCanonicalEntity[] = [];
  for (const group of groupRegexRows(valid)) {
    try {
      const file = {
        version: 1,
        type: "lumiverse_regex_scripts",
        scripts: group.rows.map((read) => regexRowToScript(read.row, read.inner)),
      };

      let filename = "Lumiverse regex scripts.json";
      let linkInfo: Record<string, unknown> | undefined;
      if (group.scope !== "account") {
        const table = group.scope === "character" ? "characters" : "presets";
        const resolved = links.resolve(`regex_scripts/${group.scopeId}`, table, group.scopeId!, report);
        filename = resolved ? `${resolved.name} regex.json` : `${group.scopeId} regex.json`;
        linkInfo = { scope: group.scope, scopeId: group.scopeId, resolvedId: resolved?.id ?? null };
      }

      const entity = regexAdapter.toCanonical({ text: JSON.stringify(file), filename });
      const escrowed = addArchiveEscrow(
        entity,
        "regex_scripts",
        { rows: group.rows.map((read) => read.row) },
        linkInfo ? { links: linkInfo } : undefined,
      );
      recordImported(report, "regex", { id: escrowed.id, name: escrowed.body.name });
      out.push(escrowed);
    } catch (error) {
      for (const read of group.rows) {
        recordFailure(report, codecRowFailure("regex_scripts", read.row, error));
      }
    }
  }
  return out;
}
