/**
 * The preset slice (spec Behavior step 5, preset row; step 7 for isolation). A `presets` row is the
 * lumiverse-preset wrapper's INNER BLOCK MODEL, not the wrapper itself: upstream's own frontend
 * builds the `{type: "lumiverse_preset", preset: {...}}` file the codec parses FROM this row via a
 * blocks transformation (`sanitizeLumiHubSealedBlocksForExport`, not vendored into this repo), so
 * `presetRowToWrapper` replicates that shape mechanically rather than reusing any upstream logic.
 * Once synthesized, dispatch goes through the already-shipped Lumiverse preset codec
 * (src/formats/lumiverse/preset.ts) via `inspectPresetBundle` (src/convert.ts); no field mapping
 * lives here twice.
 *
 * `prompts` (object, keyed by identifier: name/content/enabled/role) and `prompt_order` (array of
 * ordering entries: identifier/enabled/depth/position/injectionTrigger/role) are joined by
 * identifier into one `preset.blocks[]` entry per ordered prompt. A prompt with no matching
 * prompt_order entry still survives, appended disabled at the end (no ordering data to place it
 * with, never dropped). An order entry naming no real prompt has nothing to build a block from and
 * is skipped rather than fabricated.
 *
 * `parameters.samplerOverrides` is the one nested row field the codec actually reads (it drives
 * `body.samplers`); everything else this row carries that has no wrapper slot the codec consumes
 * (`id`, `description`, `parameters.customBody`, `provider`, `engine`, `metadata`) still rides the
 * wrapper as an extra `preset.*` key. The codec escrows the whole wrapper verbatim
 * (`original.lumiverse.raw`, verified against preset.ts's own `toCanonical`), so every one of those
 * survives with zero codec changes; anything that has no wrapper slot at all still survives through
 * `addArchiveEscrow`'s own raw-row twin.
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import presetCodec from "../lumiverse/preset";
import { inspectPresetBundle } from "../../convert";
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
import { rowId, type InnerJsonResult } from "./tables";

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/**
 * Synthesize the `{type: "lumiverse_preset", preset: {...}}` wrapper the codec's `isLumiverseWrapper`
 * detects and `lumiverseToStRaw` converts. Field-by-field:
 *
 * - `id`, `name`, `description` -> `preset.id`/`name`/`description` (id/description have no wrapper
 *   slot the codec's own toCanonical reads; they survive as escrow only, exactly as upstream's own
 *   wrapper carries them, per the spec's own open-question note on `preset.id`).
 * - `prompts` + `prompt_order`, joined by identifier -> `preset.blocks[]` (see module doc).
 * - `parameters.samplerOverrides` -> `preset.samplerOverrides` (consumed: feeds body.samplers).
 * - `parameters.customBody`, `provider`, `engine`, `metadata` -> same-named `preset.*` keys, never
 *   consumed by the codec, surviving purely as escrow on the wrapper twin.
 */
export function presetRowToWrapper(
  row: Record<string, unknown>,
  inner: InnerJsonResult,
): Record<string, unknown> {
  const prompts = asRecord(inner.values.prompts) ?? {};
  const promptOrder = Array.isArray(inner.values.prompt_order) ? inner.values.prompt_order : [];
  const parameters = asRecord(inner.values.parameters);

  const blocks: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const entryRaw of promptOrder) {
    const entry = asRecord(entryRaw);
    const identifier = entry && typeof entry.identifier === "string" ? entry.identifier : undefined;
    if (!entry || !identifier) continue;
    seen.add(identifier);
    const prompt = asRecord(prompts[identifier]);
    if (!prompt) continue; // an order entry naming no real prompt has nothing to build a block from

    blocks.push({
      id: identifier,
      name: asString(prompt.name),
      content: asString(prompt.content),
      role: entry.role,
      enabled: entry.enabled !== false && prompt.enabled !== false,
      depth: entry.depth,
      position: entry.position,
      injectionTrigger: entry.injectionTrigger,
      marker: prompt.marker,
    });
  }

  for (const [identifier, promptRaw] of Object.entries(prompts)) {
    if (seen.has(identifier)) continue;
    const prompt = asRecord(promptRaw);
    if (!prompt) continue;
    blocks.push({
      id: identifier,
      name: asString(prompt.name),
      content: asString(prompt.content),
      role: prompt.role,
      enabled: false, // no order entry ever placed it; ride disabled at the end rather than drop it
      marker: prompt.marker,
    });
  }

  return {
    type: "lumiverse_preset",
    preset: {
      id: row.id,
      name: asString(row.name),
      description: asString(row.description),
      blocks,
      samplerOverrides: parameters?.samplerOverrides,
      customBody: parameters?.customBody,
      provider: row.provider,
      engine: row.engine,
      metadata: inner.values.metadata,
    },
  };
}

/** The three JSON-string columns actually consumed for canonical mapping (prompts/prompt_order
 * build blocks[], parameters.samplerOverrides feeds body.samplers). metadata is escrow-only. */
const GATING_COLUMNS = new Set(["prompts", "prompt_order", "parameters"]);

/**
 * Unlike personas/world_books (whose one JSON-string column is never consumed, so it never gates),
 * a preset row whose prompts, prompt_order, or parameters will not parse loses real mapped content,
 * so it fails the row, the shared default policy. A metadata-only failure never gates: nothing
 * consumes it, matching the persona/world_books precedent.
 */
function presetGatingFailure(read: TableRow): LvbakRowFailure | null {
  if (!read.inner.failures.some((f) => GATING_COLUMNS.has(f.column))) return null;
  return innerJsonRowFailure("presets", read);
}

export interface ImportPresetsOptions {
  lineCeiling: number;
  report: LvbakImportReport;
  links: LinkMap;
}

/**
 * Import every preset: synthesize and dispatch, escrow the raw twin, and record the preset under
 * its Lumiverse id (spec step 6: a regex row can scope to a preset the same way it scopes to a
 * character). A codec-level (or any other unexpected) throw during synthesis/dispatch fails only
 * that row: recorded via recordFailure, the stream continues.
 */
export async function importPresets(
  source: LvbakEntrySource,
  options: ImportPresetsOptions,
): Promise<ParsedCanonicalEntity[]> {
  const { lineCeiling, report, links } = options;
  const opts: ReadTableOptions = {
    lineCeiling,
    onFailure: (failure) => recordFailure(report, failure),
  };

  const out: ParsedCanonicalEntity[] = [];
  for await (const read of readTable(source, "presets", opts)) {
    const gating = presetGatingFailure(read);
    if (gating) {
      recordFailure(report, gating);
      continue;
    }

    try {
      const wrapper = presetRowToWrapper(read.row, read.inner);
      const name = asString(read.row.name) || "preset";
      const { entity } = inspectPresetBundle(presetCodec, {
        text: JSON.stringify(wrapper),
        filename: `${name}.json`,
      });

      const escrowed = addArchiveEscrow(entity, "presets", read.row);
      links.record("presets", rowId(read.row), { id: escrowed.id, name: escrowed.body.name });
      recordImported(report, "preset", { id: escrowed.id, name: escrowed.body.name });
      out.push(escrowed);
    } catch (error) {
      recordFailure(report, codecRowFailure("presets", read.row, error));
    }
  }
  return out;
}
