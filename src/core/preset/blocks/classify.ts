/**
 * What kind of block is this, decided from the block itself.
 *
 * WHY THIS ABSTAINS BY DEFAULT, which is the whole design. Nothing labels a real preset's blocks, so
 * coherence checking could only ever run on blocks somebody typed a pattern id for by hand. Closing
 * that gap with a classifier that guesses would be worse than the gap: a wrong pattern id makes
 * `checkCoherence` report an ordering violation in a preset that works, and a person who sees one
 * false finding stops believing the true ones. So this reports a pattern only where a signal proves
 * one and returns `null` otherwise, and callers check the classified subset.
 *
 * MEASURED FIRST, then validated. Across a corpus of 21 real presets (2,130 blocks): the marker flag
 * and empty content appear in every file, setvar in 11 and getvar in 10. Some authors additionally
 * annotate their blocks in comment macros, and 188 blocks carried an explicit declaration of the one
 * property structure cannot see. Classifying those 188 from shape alone, with every annotation
 * stripped, agreed with the declaration 187 times. That is the validation for the rules below, and
 * it is why nothing here reads an annotation: it would buy under one percent of coverage in exchange
 * for depending on one community's private vocabulary.
 *
 * THE ASSEMBLER IS DELIBERATELY UNCLAIMABLE, and this is the finding that cost the most to reach.
 * The renderer reads a manifest of variables - but so does a tracker, and so does a settings mirror,
 * with the same macro in the same shape. An earlier rule claimed the biggest reader in each preset.
 * Measured against the corpus, the biggest reader in one preset is a settings reminder, and in every
 * preset that assembles at all the top two readers are within a factor of two of each other (86/57,
 * 46/42, 27/26, 22/18, 16/16). There is no dominant renderer to find. Since `assembler` carries the
 * strongest ordering rules in the catalog - after every writer, requires an initializer - a wrong
 * one is precisely how this module would report a violation in a preset that works. So it is not
 * claimed at all, and the reads that would have suggested it are left unknown.
 *
 * THE ONE DELIBERATE ASYMMETRY, which those 188 blocks are exactly about. A block that writes state
 * with a value is either an exclusive option or an additive module, and the two are structurally
 * identical - same macros, same trim, same shape. It is reported as `option-additive`, always,
 * because that pattern carries the WEAKER ordering rule: additive says only "after the initializer",
 * exclusive adds "before the assembler". Guessing the weaker one means a misclassification can lose
 * a finding but can never invent one. The lost check is recovered anyway, because the assembler's
 * own rule already requires every writer to precede it.
 */
import type { PresetPrompt } from "../../../entities/preset";

/** One block as this module needs to see it. Deliberately not PresetPrompt, so a caller can classify
 *  something it built by hand or read from a foreign shape. */
export interface ClassifiableBlock {
  readonly identifier: string;
  readonly name?: string;
  readonly content?: string;
  readonly marker?: boolean;
  readonly enabled?: boolean;
}

export type ClassifierEvidence =
  | "marker-flag"
  | "empty-and-divider-name"
  | "blank-assignments"
  | "getvar-manifest"
  | "writes-state";

export interface Classification {
  readonly identifier: string;
  /** A catalog pattern id, or null where nothing proved one. Null is the honest common case. */
  readonly pattern: string | null;
  /** What decided it, so a person can disagree with the reason rather than with the verdict. */
  readonly evidence: ClassifierEvidence | null;
}

/** Blank assignments needed before a block counts as the initializer rather than one stray reset. */
const BLANK_ASSIGNMENTS_MIN = 3;
/** Reads needed before a block counts as the renderer. Surveyed assemblers carry 12 to 126. */
const GETVAR_MANIFEST_MIN = 10;

const BLANK_SETVAR = /\{\{setvar::[^:}]+::\s*\}\}/gi;
const ANY_SETVAR = /\{\{setvar::[^:}]+::/gi;
/** Counts openings, not balanced pairs. A read whose variable name is itself built from a macro
 *  (`{{getvar::{{...}}}}`) never closes cleanly, and requiring a clean close undercounted the
 *  largest manifests in the corpus by more than half - which is to say it missed real assemblers. */
const ANY_GETVAR = /\{\{getvar::/gi;
/** A name that is drawn rather than written: rules, box-drawing, repeated punctuation. */
const DIVIDER_NAME = /[=\-─═▬≡•·_~*#]{3,}/;

const count = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

/** Does this block put anything in the prompt? A comment macro is authored text that renders as
 *  nothing, so a block holding only comments is empty from the model's side, which is the side that
 *  matters. Treating it as non-empty would classify a labelled divider as prose. */
const rendersNothing = (content: string): boolean =>
  content.replace(/\{\{\/\/[^}]*\}\}/g, "").trim() === "";

/** Classify one block. Null pattern means nothing proved one, which is not a failure. */
export function classifyBlock(block: ClassifiableBlock): Classification {
  const identifier = block.identifier;
  const content = block.content ?? "";

  // The engine's own reserved slot. The only signal that is a flag rather than a reading of prose,
  // and the only one present in every surveyed preset.
  if (block.marker) return { identifier, pattern: "engine-slot", evidence: "marker-flag" };

  if (rendersNothing(content)) {
    // Renders nothing and is NOT a marker: either a divider drawn in its name, or a block somebody
    // emptied. Only the drawn one is claimed, because "empty with an ordinary name" says nothing
    // about intent, and a preset carries hundreds of those.
    return DIVIDER_NAME.test(block.name ?? "")
      ? { identifier, pattern: "divider", evidence: "empty-and-divider-name" }
      : { identifier, pattern: null, evidence: null };
  }

  if (count(content, BLANK_SETVAR) >= BLANK_ASSIGNMENTS_MIN) {
    return { identifier, pattern: "variable-init", evidence: "blank-assignments" };
  }
  // NOTE: reading many variables does NOT decide `assembler` here. See classifyBlocks.
  // A state writer. Reported as the weaker of the two indistinguishable patterns; see the header.
  if (count(content, ANY_SETVAR) > count(content, BLANK_SETVAR)) {
    return { identifier, pattern: "option-additive", evidence: "writes-state" };
  }

  // Prose. Tracker, anti-slop, reasoning scaffold and the rest differ by what they SAY, and this
  // module reads structure. Naming one here would be a guess wearing a verdict's clothes.
  return { identifier, pattern: null, evidence: null };
}

/** Classify a preset's blocks in evaluation order. */
export const classifyBlocks = (
  blocks: readonly ClassifiableBlock[],
): Classification[] => blocks.map(classifyBlock);

/** Adapt canonical prompts, the shape a real imported preset arrives in. */
export const fromPrompts = (prompts: readonly PresetPrompt[]): ClassifiableBlock[] =>
  prompts.map((prompt) => ({
    identifier: prompt.id,
    name: prompt.name,
    content: prompt.content,
    marker: prompt.marker === true,
    enabled: prompt.enabled !== false,
  }));

/** How much of a preset the classifier could actually speak to. Reported rather than hidden, because
 *  a coherence result over 30% of the blocks is a different claim than one over all of them. */
export const coverage = (results: readonly Classification[]): { known: number; total: number } => ({
  known: results.filter((r) => r.pattern !== null).length,
  total: results.length,
});
