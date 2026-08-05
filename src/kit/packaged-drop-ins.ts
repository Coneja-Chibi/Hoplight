/**
 * One owner for "can this build read its own folders?".
 *
 * Kit finds its commands, tools, checks, spokes and channels by walking the directory they live in.
 * That is the whole drop-in convention and it stays the source of truth. It is also impossible inside
 * a compiled binary: `import.meta.url` resolves onto Bun's virtual filesystem, which has no listable
 * directory, so the walk throws ENOENT. Kit's first startup call is `discoverCommands`, which is why
 * the shipped executable exited before drawing anything.
 *
 * The signal is the same one ensure-formats.ts uses, and it is a fact rather than a guess: the Kit
 * binary is compiled inside the asset bake, so PACKAGED_ASSETS is non-null in exactly the builds that
 * cannot walk a folder, and null in a source checkout that can.
 */
import { PACKAGED_ASSETS } from "../generated/packaged-assets";
import { KIT_DROP_INS } from "./generated/drop-ins";

/** True when this process cannot read its own source folders and must use the baked manifest. */
export const isPackagedBuild = (): boolean => PACKAGED_ASSETS !== null;

/**
 * The baked drop-ins for one family, or null when the folder walk is available and preferred.
 *
 * Returns null in a source checkout deliberately. Dropping in a file has to work the moment it is
 * saved, without regenerating anything; the manifest is a build artifact, and `kit:manifest --check`
 * is what keeps it honest rather than making it the only path.
 */
export function packagedDropIns(family: keyof typeof KIT_DROP_INS): readonly unknown[] | null {
  return isPackagedBuild() ? KIT_DROP_INS[family] : null;
}
