/**
 * A blank preset that actually loads: every field the platform needs, and nothing anyone has to
 * invent.
 *
 * WHAT THIS DOES AND DOES NOT COVER, because the difference matters. It produces the BLOCK half of a
 * starter: the skeletons, in dependency order, as a canonical body any adapter can write out. Passed
 * through buildStPreset it yields a file that imports and renders clean.
 *
 * IT ALSO CARRIES SETTINGS, which it did not always. A preset holds sampler values, system-prompt
 * templates, behaviour flags and API options as well as blocks; a body with none of those groups
 * makes the writer emit two top-level fields, and a file like that loads and then runs on whatever
 * settings the application already had. That is worse than refusing, because it looks like it worked.
 * starter-settings.ts supplies them, transcribed from SillyTavern's own shipped default rather than
 * guessed, and a live test holds them to it.
 *
 * The connection is the deliberate exception: no model, source, proxy or URL. Those describe the
 * machine a preset was made on, and inheriting the current one is the right answer for exactly that
 * group. The reasoning is in starter-settings.ts, beside the values.
 *
 * THE ADAPTER OWNS THE FIELD LIST, NOT THIS FILE. buildStPreset already knows every field the wire
 * format carries, because it is what writes real presets on the way out. Hand-listing them here would
 * create a second answer to "what does a SillyTavern preset contain", and the two would drift the
 * first time the format changed. So the canonical body goes through the same writer everything else
 * uses, and this module only supplies the blocks and the name.
 */
import { emptyPresetBody, type PresetBody, type PresetPrompt } from "../../../entities/preset";
import { starterBlocks, type BlockSkeleton } from "./skeletons";
import { starterSettings } from "./starter-settings";

/** The canonical preset a starter is built from: the skeleton blocks, in dependency order, over the
 *  settings a fresh install ships. */
export function starterBody(name: string): PresetBody {
  const blocks = starterBlocks();
  return {
    ...emptyPresetBody(name),
    ...starterSettings(),
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
