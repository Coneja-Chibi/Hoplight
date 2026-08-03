/**
 * A blank preset that actually loads: every field the platform needs, and nothing anyone has to
 * invent.
 *
 * WHAT THIS DOES AND DOES NOT COVER, because the difference matters. It produces the BLOCK half of a
 * starter: the skeletons, in dependency order, as a canonical body any adapter can write out. Passed
 * through buildStPreset it yields a file that imports and renders clean.
 *
 * IT DOES NOT YET CARRY SETTINGS. A SillyTavern preset also holds sampler values, system-prompt
 * templates, behaviour flags and API options, and an empty canonical body has none of those groups,
 * so the writer emits exactly two top-level fields. A file like that loads and then runs on whatever
 * settings the application already had, which is worse than refusing because it looks like it worked.
 *
 * Those defaults are deliberately not invented here. A wrong sampler value that renders fine is the
 * kind of thing nobody notices for weeks, so they need to come from a real install's own shipped
 * preset rather than from a plausible guess. Until then a starter is a block scaffold, and callers
 * should say so rather than describe it as a complete preset.
 *
 * THE ADAPTER OWNS THE FIELD LIST, NOT THIS FILE. buildStPreset already knows every field the wire
 * format carries, because it is what writes real presets on the way out. Hand-listing them here would
 * create a second answer to "what does a SillyTavern preset contain", and the two would drift the
 * first time the format changed. So the canonical body goes through the same writer everything else
 * uses, and this module only supplies the blocks and the name.
 */
import { emptyPresetBody, type PresetBody, type PresetPrompt } from "../../../entities/preset";
import { starterBlocks, type BlockSkeleton } from "./skeletons";

/** The canonical preset a starter is built from: the skeleton blocks, in dependency order. */
export function starterBody(name: string): PresetBody {
  const blocks = starterBlocks();
  return {
    ...emptyPresetBody(name),
    prompts: blocks.map(toPrompt),
  };
}

/**
 * One skeleton as a canonical prompt.
 *
 * Everything is enabled. A starter whose blocks ship off would render as an empty prompt and read as
 * a broken export rather than a blank canvas, and the whole point is that the first render works.
 */
function toPrompt(block: BlockSkeleton): PresetPrompt {
  return {
    id: block.identifier,
    name: block.name,
    role: block.role,
    content: block.content,
    enabled: true,
    ...(block.marker ? { marker: true } : {}),
  } as PresetPrompt;
}

/** Every skeleton's edit note, keyed by block id, for a tool or a README to show beside the file. */
export function starterNotes(): ReadonlyArray<{ id: string; name: string; edit: string }> {
  return starterBlocks().map((block) => ({
    id: block.identifier,
    name: block.name,
    edit: block.edit,
  }));
}
