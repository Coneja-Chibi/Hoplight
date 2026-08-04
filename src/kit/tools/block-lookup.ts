/**
 * "What kind of block is this, and how do I write one?" answered from the catalog.
 *
 * The same argument macro_lookup makes, applied one level up. A model asked to add a tracker produces
 * something that looks right and is architecturally wrong, because the shape depends on whether the
 * preset renders inline or assembles from variables and nothing in the file says which. Reasoned from
 * memory, that gets answered confidently and plausibly.
 *
 * The catalog is a survey of 22 community presets, so `prevalence` separates a near-universal
 * convention from one author's idea, and `hazards` carry the failures that survey actually found.
 * Every one of those renders as a complete, working preset, which is why they are worth handing to a
 * model rather than leaving it to notice.
 *
 * Four questions, which are the four somebody actually asks mid-build:
 *   explain   what is this kind of block for, how is it built, what goes wrong
 *   list      what kinds are there at all
 *   skeleton  give me a starting block I can edit
 *   check     is this arrangement of blocks coherent
 */
import { z } from "zod";
import { ALL_PATTERNS, findPattern } from "../../core/preset/blocks/patterns";
import { skeletonFor } from "../../core/preset/blocks/skeletons";
import { checkCoherence, formatCoherence } from "../../core/preset/blocks/coherence";
import { classifyBlocks } from "../../core/preset/blocks/classify";
import type { HarnessTool } from "./tool";

const input = z.strictObject({
  action: z.enum(["explain", "list", "skeleton", "check"]).default("list"),
  pattern: z.string().trim().max(60).optional()
    .describe("a pattern id such as assembler, tracker, variable-init; required for explain and skeleton"),
  blocks: z.array(z.strictObject({
    identifier: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    enabled: z.boolean().default(true),
    pattern: z.string().max(60).optional().describe("the pattern id this block is, when known"),
    marker: z.boolean().optional().describe("true for an engine slot such as chatHistory"),
    content: z.string().max(40_000).optional()
      .describe("the block's text; lets an unlabelled block be classified from its structure"),
  })).max(400).optional().describe("for check: the preset's blocks in their evaluation order"),
});

/** The catalog entry as a model should read it: facts first, then what goes wrong. */
const explain = (id: string): { summary: string; output: string } => {
  const pattern = findPattern(id);
  if (!pattern) {
    const known = ALL_PATTERNS.map((p) => p.id).join(", ");
    return {
      summary: `block_lookup explain: no pattern "${id}"`,
      output: `No pattern called "${id}". Known patterns: ${known}`,
    };
  }
  return {
    summary: `block_lookup explain ${pattern.id}`,
    output: JSON.stringify({
      id: pattern.id,
      name: pattern.name,
      purpose: pattern.purpose,
      mechanics: pattern.mechanics,
      // The single most load-bearing fact: most blocks in a variable-driven preset render nothing.
      emits: pattern.emits,
      macros: pattern.macros,
      ordering: pattern.ordering,
      hazards: pattern.hazards,
      seenIn: `${pattern.prevalence} of 13 surveyed presets`,
      hasSkeleton: skeletonFor(pattern.id) !== null,
    }),
  };
};

const blockLookup: HarnessTool<z.infer<typeof input>> = {
  name: "block_lookup",
  description:
    "Look up what a kind of prompt block is for, how it is built, and what silently goes wrong with "
    + "it; get an editable starting block; or check whether an arrangement of blocks is coherent. Use "
    + "this before writing preset blocks: ordering is evaluation order, so a block can be enabled, "
    + "expand perfectly, and never be read.",
  exposure: "direct",
  effect: "read",
  input,
  // Reads a catalog compiled into the binary: no file, no process, nothing to serialise against.
  concurrencyKey: () => "block-lookup",
  async execute(args) {
    if (args.action === "list") {
      return {
        summary: `block_lookup list: ${ALL_PATTERNS.length} patterns`,
        output: JSON.stringify(ALL_PATTERNS.map((pattern) => ({
          id: pattern.id,
          name: pattern.name,
          emits: pattern.emits,
          purpose: pattern.purpose,
          seenIn: pattern.prevalence,
        }))),
      };
    }

    if (args.action === "explain") {
      if (!args.pattern) {
        return { summary: "block_lookup explain: pattern required", output: "Name a pattern to explain." };
      }
      return explain(args.pattern);
    }

    if (args.action === "skeleton") {
      if (!args.pattern) {
        return { summary: "block_lookup skeleton: pattern required", output: "Name a pattern." };
      }
      const skeleton = skeletonFor(args.pattern);
      if (!skeleton) {
        const pattern = findPattern(args.pattern);
        return {
          summary: `block_lookup skeleton: none for ${args.pattern}`,
          output: pattern
            // Compliance shaping is catalogued and deliberately ships no starting block; saying so is
            // better than an empty result a model reads as a bug.
            ? `${pattern.name} is catalogued but Hoplight ships no starting block for it. Use explain.`
            : `No pattern called "${args.pattern}".`,
        };
      }
      return {
        summary: `block_lookup skeleton ${args.pattern}`,
        output: JSON.stringify({
          identifier: skeleton.identifier,
          name: skeleton.name,
          role: skeleton.role,
          content: skeleton.content,
          ...(skeleton.marker ? { marker: true } : {}),
          // Handed over so a model does not ship the placeholder as if it were finished.
          changeFirst: skeleton.edit,
        }),
      };
    }

    const blocks = args.blocks ?? [];
    if (blocks.length === 0) {
      return {
        summary: "block_lookup check: no blocks",
        output: "Pass the preset's blocks in evaluation order. Include content and a pattern id where"
          + " you know one; unlabelled blocks are classified from their structure where that is provable.",
      };
    }
    // A caller's own label always wins: they may know something structure cannot show. Only blocks
    // that arrive unlabelled are classified, and the classifier abstains rather than guessing, which
    // is why an imported preset can be checked at all without hand-labelling every block first.
    const classified = classifyBlocks(blocks);
    const resolved = blocks.map((block, index) => ({
      ...block,
      pattern: block.pattern ?? classified[index]!.pattern ?? undefined,
    }));
    const inferred = resolved.filter((b, i) => !blocks[i]!.pattern && b.pattern).length;
    const unknown = resolved.filter((b) => !b.pattern).length;

    const findings = checkCoherence(resolved);
    return {
      summary: findings.length === 0
        ? "block_lookup check: no ordering problems"
        : `block_lookup check: ${findings.length} finding(s)`,
      output: [
        formatCoherence(findings),
        "",
        // Stated every time, because a clean result over a third of a preset is a different claim
        // than a clean result over all of it, and the difference is invisible otherwise.
        `Checked ${resolved.length - unknown} of ${resolved.length} blocks`
        + `${inferred > 0 ? ` (${inferred} classified from structure)` : ""}.`
        + `${unknown > 0 ? ` ${unknown} could not be identified and were not checked.` : ""}`,
      ].join("\n"),
    };
  },
};

export default blockLookup;
