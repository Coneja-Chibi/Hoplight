/**
 * Studio transfer, preview half: serialize one stored piece through another platform's adapter and
 * report what the crossing costs, without writing anything.
 *
 * This is the "what would break?" tool. `studio_export` is the "do it" tool, and both call the same
 * `convertStoredPiece`, so a preview can never disagree with the write that follows it.
 *
 * The loss report is computed by the engine, never by the model. Field loss comes from the target
 * adapter's own coverage declaration; macro loss comes from the per-engine catalogs. A model asked
 * to reason about macro compatibility from names alone gets it confidently wrong, which is the
 * entire reason this returns structured findings instead of prose.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import { convertStoredPiece, loadConversionKit } from "./_transfer-common";

const INLINE_MAX_CHARS = 4_096;

const input = z.strictObject({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().trim().min(1).max(120).describe("exact studio id of the piece to transfer"),
  to: z.string().trim().min(1).max(80)
    .describe("target format adapter id, such as sillytavern-preset or rolecall-lorebook"),
});

const transfer: HarnessTool<z.infer<typeof input>> = {
  name: "studio_transfer",
  description:
    "Preview converting one stored piece to another platform's format: reports dropped fields, "
    + "escrowed fields, and macros that will not resolve on the target engine. Writes nothing. Use "
    + "studio_export to actually produce the file.",
  exposure: "deferred",
  effect: "read",
  discovery: {
    id: "transfer.export.preview",
    domain: "transfer",
    area: "export",
    action: "preview",
    summary: "Check what a conversion to another platform would cost, without writing a file.",
    aliases: [
      "what breaks if I convert",
      "preview conversion",
      "will this work in",
      "check compatibility",
      "dry run export",
    ],
    platforms: "canonical",
  },
  input,
  concurrencyKey: ({ kind, id }) => `studio/${kind}/${id}`,
  async execute({ kind, id, to }, { bridge, results }) {
    const kit = await loadConversionKit();
    const entity = await bridge.read(kind, id);
    if (!entity) {
      return {
        summary: `transfer ${kind}/${id}: not found`,
        output: `No ${kind} with id "${id}" in the studio.`,
      };
    }

    const outcome = await convertStoredPiece(kit, bridge, entity, kind, to);
    if (!outcome.ok) {
      return {
        summary: `transfer ${kind}/${id}: ${outcome.reason}`,
        output: outcome.detail,
      };
    }

    const spill = outcome.payload.length > INLINE_MAX_CHARS && results
      ? (() => {
          try {
            return results.capture(`transfer/${kind}/${id}/${to}`, outcome.payload);
          } catch {
            return null;
          }
        })()
      : null;

    const changes = outcome.translation ?? [];
    const needsReview = changes.filter((c) => c.kind === "collision" || c.kind === "absent");
    // Both counts are reported. `translated` is what this crossing changed; `dead macros` is what
    // still will not resolve on the target AFTER that, which is the number a reader actually needs.
    const deaths = outcome.macros?.findings.length ?? 0;
    return {
      summary:
        `transfer ${kind}/${id} -> ${to}: `
        + `${outcome.loss.counts.dropped ?? 0} dropped, ${outcome.loss.counts.warnings} warnings`
        + (changes.length ? `, ${changes.length} macros translated` : "")
        + (outcome.macros?.checked ? `, ${deaths} dead macros` : "")
        + (needsReview.length ? `, ${needsReview.length} need review` : ""),
      output: JSON.stringify({
        target: { kind, id },
        to,
        dialect: outcome.dialect,
        loss: outcome.loss,
        translated: changes,
        needsReview,
        macros: outcome.macros,
        // The facts about the source's own logic, so a reader deciding what to do about the entries
        // in `needsReview` has the arrays, domains, hooks and choice groups in front of them rather
        // than having to go read the preset again to find out what a dead macro was standing in for.
        structure: outcome.structure,
        // What the parts add up to. A conversion can translate every piece correctly and still
        // produce something inert; these name the order dependencies that would cause it.
        explanation: outcome.explanation,
        // The source hook machine as rules the target can run. Not written by Kit: placing
        // them is a structural edit on the target, which this path does not own.
        hookRules: outcome.hookRules,
        // Blocks split so a splice macro became a real marker block. Restructuring someone's
        // prompt list is reported, never done quietly.
        promotions: outcome.promotions,
        payload: spill ?? {
          spilled: false,
          content: outcome.payload,
          totalChars: outcome.payload.length,
        },
        note: "Preview only. Nothing was written. Use studio_export to produce the file.",
      }),
    };
  },
};

export default transfer;
