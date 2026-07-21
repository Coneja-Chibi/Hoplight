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
 *
 * SCOPE: the axis here is PresetWriteForProfile, the hosts a preset can be AUTHORED FOR. Lumiverse
 * joined once its engine was cloned as primary source: the real dialect is {{...}} with ::
 * separators (the earlier [[name]]/CBS worry came from LumiRealm, a third-party Risu port, not
 * Lumiverse itself), and its heavy aliasing is modeled first-class via MacroEntry.aliases, which
 * support.ts consults, so valid aliases never warn as unsupported.
 *
 * Risu / Agnai stay absent, and do NOT just bolt them on - their engines still break this model:
 *  1. SYNTAX. Risu's CBS documents its macros as [[name]] (48 uses in its own cbs_docs.cbs, zero
 *     {{name}}). scanMacroTokens only matches {{...}}, so it is blind to Risu text.
 *  2. COLLISIONS. LumiRealm's catalog marks 36 names where Lumi and Risu diverge on a shared name.
 *     The {{random::a::b}} trap, 36 more times; name-level checks cannot see it.
 * Agnai is not this shape at all - it is a template system of named slots (system/history/post).
 * Ground truth if/when it is needed: _reference/RisuAI/src/etc/docs/cbs_docs.cbs (CSV: name,
 * description, aliases, arguments, example), _reference/LumiRealm/src/core/cbs/catalog/
 * risu-macros.json (187 entries, machine-readable - generate it, never hand-copy), and
 * _reference/agnai/common/template-parser.ts.
 */
import type { PresetWriteForProfile } from "../capabilities";
import type { MacroGroup } from "./types";
import { ROLECALL_MACRO_GROUPS } from "./rolecall";
import { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
import { MARINARA_MACRO_GROUPS } from "./marinara";
import { LUMIVERSE_MACRO_GROUPS } from "./lumiverse";

export type { MacroEntry, MacroGroup } from "./types";
export { ROLECALL_MACRO_GROUPS } from "./rolecall";
export { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
export { MARINARA_MACRO_GROUPS } from "./marinara";
export { LUMIVERSE_MACRO_GROUPS } from "./lumiverse";

/**
 * The catalog each Write-for lens exposes. `full` (Hoplight) carries the superset dialect, mirroring
 * placementsForProfile("full") which likewise returns every stop RoleCall carries: vaud has no
 * runtime of its own, so the canonical lens shows the richest engine we model rather than inventing
 * a dialect nothing runs.
 */
const CATALOG_BY_PROFILE: Record<PresetWriteForProfile, MacroGroup[]> = {
  full: ROLECALL_MACRO_GROUPS,
  rolecall: ROLECALL_MACRO_GROUPS,
  sillytavern: SILLYTAVERN_MACRO_GROUPS,
  marinara: MARINARA_MACRO_GROUPS,
  lumiverse: LUMIVERSE_MACRO_GROUPS,
};

/** The macro groups the selected lens's engine actually supports. */
export function macroGroupsForProfile(profile: PresetWriteForProfile): MacroGroup[] {
  return CATALOG_BY_PROFILE[profile] ?? ROLECALL_MACRO_GROUPS;
}
