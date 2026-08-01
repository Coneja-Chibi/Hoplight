/**
 * Studio export: convert one stored piece to another platform's format and write the file.
 *
 * THE MODEL NEVER SUPPLIES A PATH. It names a piece and a target format; the filename is derived
 * from the piece id plus the adapter's own extension, and the file lands in `<studio>/exports`.
 * That is what makes a model-callable file write safe: there is no path argument to redirect, so
 * containment is structural rather than a validation anyone can forget. `resolveStudioExportPath`
 * additionally runs the id through canonical storage's own safety check and restricts the extension
 * to a closed set.
 *
 * Create-only. An export that silently replaced an earlier file could destroy something already
 * sent to someone, and unlike a canonical piece there is no revision history to recover it from.
 *
 * Binary carriers (PNG cards, .charx, .byaf) are refused rather than mangled: the StudioFs seam is
 * text-only today, and writing a corrupted card would be far worse than declining. Every preset,
 * lorebook, persona and regex adapter is text, so the refusal is narrow and it names the CLI, which
 * can already do the binary case.
 *
 * Shares `convertStoredPiece` with `studio_transfer`, so the preview and the write can never report
 * different losses.
 *
 * WHY DIRECT. `capabilities/runtime.ts` refuses any DEFERRED workflow whose effect is `apply`,
 * because discovery metadata must never be what classifies a write. A deferred tool carrying no
 * discovery descriptor is worse than refused: it registers but can never be revealed, so the model
 * cannot reach it at all. Direct also removes a reliability dependency that matters here. "Convert
 * my preset" has to work every time, and a deferred tool only works when search ranks it into the
 * top five. Its one classification is the explicit `["studio_export", "write"]` entry in the safety
 * trust map, so it still pauses at the Gate under the default guarded mode.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import { convertStoredPiece, loadConversionKit } from "./_transfer-common";

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().trim().min(1).max(120).describe("exact studio id of the piece to export"),
  to: z.string().trim().min(1).max(80)
    .describe("target format adapter id, such as sillytavern-preset or sillytavern-lorebook"),
});

const exportPiece: HarnessTool<z.infer<typeof input>> = {
  name: "studio_export",
  description:
    "Convert a stored piece to another platform's format and write it into the studio's exports "
    + "folder. Reports the exact file written plus everything the conversion cost: dropped fields "
    + "and macros that will not resolve on the target engine.",
  exposure: "direct",
  effect: "apply",
  input,
  concurrencyKey: ({ kind, id }) => `studio/export/${kind}/${id}`,
  async execute({ kind, id, to }, { bridge, exports: exportStore }) {
    if (!exportStore) {
      return {
        summary: `export ${kind}/${id}: unavailable`,
        output: "This Kit session has no exports folder bound, so nothing was written.",
        outcome: "failed",
      };
    }
    const kit = await loadConversionKit();
    const entity = await bridge.read(kind, id);
    if (!entity) {
      return {
        summary: `export ${kind}/${id}: not found`,
        output: `No ${kind} with id "${id}" in the studio. Nothing was written.`,
        outcome: "stale",
      };
    }

    const outcome = await convertStoredPiece(kit, bridge, entity, kind, to);
    if (!outcome.ok) {
      return {
        summary: `export ${kind}/${id}: ${outcome.reason}`,
        output: `${outcome.detail} Nothing was written.`,
        outcome: "failed",
      };
    }
    if (outcome.text === null) {
      return {
        summary: `export ${kind}/${id}: binary target`,
        output:
          `"${to}" emits a binary ${outcome.suggestedExtension} carrier, which Kit cannot write `
          + "safely yet. Use the CLI for this one: hoplight convert <in> <out> --to "
          + `${to}. Nothing was written.`,
        outcome: "failed",
      };
    }

    let receipt;
    try {
      receipt = await exportStore.write(id, outcome.suggestedExtension, outcome.text);
    } catch (error) {
      return {
        summary: `export ${kind}/${id}: write failed`,
        output: `Could not write the export: ${(error as Error).message}. Nothing was written.`,
        outcome: "failed",
      };
    }
    if (receipt.status === "exists") {
      return {
        summary: `export ${kind}/${id}: already exists`,
        output:
          `${receipt.relativePath} already exists and was NOT replaced. Rename or remove it first, `
          + "or duplicate the piece under a new id and export that.",
        outcome: "stale",
      };
    }

    const changes = outcome.translation ?? [];
    const needsReview = changes.filter((c) => c.kind === "collision" || c.kind === "absent");
    const deaths = outcome.macros?.findings.length ?? 0;
    const notes = [
      changes.length ? `${changes.length} macros translated` : "",
      outcome.macros?.checked && deaths ? `${deaths} still unsupported` : "",
      needsReview.length ? `${needsReview.length} need review` : "",
    ].filter(Boolean);
    return {
      summary:
        `export ${kind}/${id} -> ${receipt.relativePath}`
        + (notes.length ? ` (${notes.join(", ")})` : ""),
      output: JSON.stringify({
        wrote: receipt.relativePath,
        path: receipt.path,
        bytes: receipt.bytes,
        to,
        dialect: outcome.dialect,
        loss: outcome.loss,
        // What was changed on the way out, each with a reason. `collision` and `absent` are the
        // ones a person should look at; the rest were mechanical and are safe.
        translated: changes,
        needsReview,
        macros: outcome.macros,
        // The source's own logic, in facts: arrays and their index ranges, variables with a closed
        // set of values, hooks that append to lists, and what each choice group actually declares.
        // These are what an entry in `needsReview` has to be reasoned about against.
        structure: outcome.structure,
        // What the parts add up to. A conversion can translate every piece correctly and still
        // produce something inert; these name the order dependencies that would cause it.
        explanation: outcome.explanation,
        // The source hook machine as rules the target can run. Not written by Kit: placing
        // them is a structural edit on the target, which this path does not own.
        hookRules: outcome.hookRules,
        // Rules whose replacement the destination will not run. Absent means not checked, never clean.
        ruleNotes: outcome.ruleNotes,
        // Blocks split so a splice macro became a real marker block. Restructuring someone's
        // prompt list is reported, never done quietly.
        promotions: outcome.promotions,
        // Cleanup macros removed by fixing what produced the mess, and the ones that could
        // not be traced back, with the reason each was left alone.
        producerFixes: outcome.producerFixes,
      }),
      outcome: "applied",
    };
  },
};

export default exportPiece;
