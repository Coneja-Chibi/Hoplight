/**
 * "What is the SillyTavern version of this?" answered from the engines' own catalogs.
 *
 * This exists because the system is meant to be used WITH a model, not instead of one. A model
 * reasoning about macro equivalence from memory gets it wrong in the most expensive way: confidently
 * and plausibly. `{{random::a::b}}` looks like the same macro on RoleCall and SillyTavern and is
 * not. So the engine supplies the facts, the model does the judging, and the answer it gives is
 * grounded in a catalog that scripts/macro-oracle verifies against the real engine.
 *
 * Three questions, which are the three a person actually asks mid-conversion:
 *   explain    what does this token do, and does the target have it?
 *   equivalent what should this become on the target, including the stated rewrite when there is one?
 *   list       what does this engine have in this area at all?
 */
import { z } from "zod";
import { PRESET_WRITE_FOR_PROFILES } from "../../core/preset/capabilities";
import { macroGroupsForProfile } from "../../core/preset/macros";
import { findMacro, macroName } from "../../core/preset/macros/support";
import { equivalentOf, formsForOp, resolveEntry } from "../../core/preset/macros/equivalence";
import type { HarnessTool } from "./tool";

const LIMIT = 40;

const input = z.strictObject({
  action: z.enum(["explain", "equivalent", "list"]).default("explain"),
  engine: z.enum(PRESET_WRITE_FOR_PROFILES)
    .describe("the engine the macro is written for"),
  target: z.enum(PRESET_WRITE_FOR_PROFILES).optional()
    .describe("the engine you want it to work on; required for equivalent"),
  macro: z.string().trim().max(200).optional()
    .describe("a macro token such as {{charCreator}} or a bare name such as charCreator"),
  area: z.string().trim().max(80).optional()
    .describe("for list: a group name such as Variables, Conditionals, Identity"),
});

/** Accept both "{{roll::1d6}}" and "roll" so a caller never has to guess the punctuation. */
const nameOf = (raw: string): string =>
  raw.includes("{{") ? macroName(raw) : raw.trim().toLowerCase().replace(/^\//, "");

const macroLookup: HarnessTool<z.infer<typeof input>> = {
  name: "macro_lookup",
  description:
    "Look up what a macro does on one engine and what it should become on another. Use this instead "
    + "of guessing an equivalent: names collide across engines while meanings do not follow them.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: ({ engine, target }) => `macro/${engine}/${target ?? "-"}`,
  async execute(args) {
    const { engine, macro, action } = args;

    if (action === "list") {
      const groups = macroGroupsForProfile(engine)
        .filter((group) => !args.area || group.name.toLowerCase().includes(args.area.toLowerCase()));
      if (groups.length === 0) {
        const names = macroGroupsForProfile(engine).map((group) => group.name).join(", ");
        return {
          summary: `macro list ${engine}: no such area`,
          output: `No area matching "${args.area}" on ${engine}. Areas: ${names}`,
        };
      }
      return {
        summary: `macro list ${engine}${args.area ? `/${args.area}` : ""}: ${groups.length} areas`,
        output: JSON.stringify(groups.map((group) => ({
          area: group.name,
          macros: group.macros.slice(0, LIMIT).map((entry) => entry.macro),
          total: group.macros.length,
        }))),
      };
    }

    if (!macro) {
      return {
        summary: `macro ${action}: macro required`,
        output: `Pass a macro token or name to ${action}.`,
      };
    }
    const name = nameOf(macro);
    const token = macro.includes("{{") ? macro : `{{${name}}}`;
    const entry = findMacro(engine, token);

    if (action === "explain") {
      // "On this platform it is X, and on the others it is A and B." The cross-engine half is a
      // join on the canonical op, so it stays correct as engines are added and is never a table.
      const resolved = resolveEntry(engine, name, 0) ?? entry;
      const elsewhere = resolved?.op
        ? formsForOp(resolved.op)
            .filter((form) => form.engine !== engine && form.engine !== "full")
            .map((form) => ({ engine: form.engine, form: form.entry.macro }))
        : [];
      return {
        summary: `macro explain ${engine}/${name}: ${resolved ? "known" : "unknown"}`,
        output: JSON.stringify({
          engine,
          name,
          known: Boolean(resolved),
          form: resolved?.macro ?? null,
          description: resolved?.description ?? null,
          aliases: resolved?.aliases ?? [],
          operation: resolved?.op ?? null,
          elsewhere,
        }),
      };
    }

    // equivalent
    const target = args.target;
    if (!target) {
      return {
        summary: "macro equivalent: target required",
        output: "Pass the engine you want the macro to work on as `target`.",
      };
    }
    // Sample arguments come from the source's own documented form, so the rendered answer shows the
    // target's real punctuation rather than a guess.
    const sourceEntry = resolveEntry(engine, name, 0) ?? entry;
    const sampleArgs = (sourceEntry?.macro.match(/::/g)?.length ?? 0) > 0
      ? sourceEntry!.macro.replace(/^\{\{/, "").replace(/\}\}$/, "").split("::").slice(1)
      : [];
    const match = equivalentOf(engine, target, name, sampleArgs);
    const targetEntry = findMacro(target, token);

    return {
      summary: `macro equivalent ${engine}->${target}/${name}: ${match.verdict}`,
      output: JSON.stringify({
        from: { engine, name, form: match.source?.macro ?? null, operation: match.source?.op ?? null },
        to: target,
        verdict: match.verdict,
        why: match.why,
        targetForm: match.target?.macro ?? targetEntry?.macro ?? null,
        candidates: match.candidates,
        rewritten: match.rewritten,
      }),
    };
  },
};

export default macroLookup;
