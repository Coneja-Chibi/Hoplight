/**
 * The macro reference, per platform (folders-as-schema: one catalog per engine).
 *
 * HARD LESSON, do not undo: this used to be RoleCall's catalog filtered by group name per lens. An
 * audit against each engine's own source found that wrong in both directions - the SillyTavern lens
 * showed 55/91 macros ST cannot run while hiding 48 it can, and worse, macros that LOOK shared mean
 * different things ({{random::a::b}} picks from a list in ST but is a min/max range in RC). Macro
 * sets, separators AND semantics are all per-engine, so a filtered single catalog cannot be correct.
 *
 * Each catalog is transcribed from that engine's own capability source. See the platform files.
 */
import type { PresetWriteForProfile } from "../capabilities";
import type { MacroGroup } from "./types";
import { ROLECALL_MACRO_GROUPS } from "./rolecall";
import { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
import { MARINARA_MACRO_GROUPS } from "./marinara";

export type { MacroEntry, MacroGroup } from "./types";
export { ROLECALL_MACRO_GROUPS } from "./rolecall";
export { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
export { MARINARA_MACRO_GROUPS } from "./marinara";

/**
 * The catalog each Write-for lens exposes. `full` (Vaude) carries the superset dialect, mirroring
 * placementsForProfile("full") which likewise returns every stop RoleCall carries: vaud has no
 * runtime of its own, so the canonical lens shows the richest engine we model rather than inventing
 * a dialect nothing runs.
 */
const CATALOG_BY_PROFILE: Record<PresetWriteForProfile, MacroGroup[]> = {
  full: ROLECALL_MACRO_GROUPS,
  rolecall: ROLECALL_MACRO_GROUPS,
  sillytavern: SILLYTAVERN_MACRO_GROUPS,
  marinara: MARINARA_MACRO_GROUPS,
};

/** The macro groups the selected lens's engine actually supports. */
export function macroGroupsForProfile(profile: PresetWriteForProfile): MacroGroup[] {
  return CATALOG_BY_PROFILE[profile] ?? ROLECALL_MACRO_GROUPS;
}
