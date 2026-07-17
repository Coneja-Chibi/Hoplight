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
 * SCOPE, and why Lumiverse / Risu / Agnai are absent: the axis here is PresetWriteForProfile, the
 * four hosts a preset can be AUTHORED FOR. Lumiverse presets import but never serialize back, and
 * Risu/Agnai have no preset lens, so none of them belong on this axis today.
 *
 * Do NOT just bolt them on when that changes - their engines break this model's assumptions, and a
 * naive add would be wrong in three ways (checked against the local clones, 2026-07):
 *  1. SYNTAX. Risu's CBS documents its macros as [[name]] (48 uses in its own cbs_docs.cbs, zero
 *     {{name}}). scanMacroTokens only matches {{...}}, so it is blind to Risu text.
 *  2. ALIASES. 77 of the 187 macros in LumiRealm's risu-macros.json carry aliases (#puredisplay =
 *     pure_display = pure-display). One-name-per-macro would emit false "unsupported" for valid
 *     aliases - a wrong warning is worse than none.
 *  3. COLLISIONS. That same catalog marks 36 entries with `lumiverseCollision`: Lumi's own record of
 *     where it diverges from Risu on a shared name. The {{random::a::b}} trap, 36 more times.
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
