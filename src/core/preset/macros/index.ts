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
 * RISU IS NOW HERE AS A REFERENCE, NOT AS A WRITE-FOR LENS, and one of the two reasons it was kept
 * out turned out to be wrong.
 *
 *  1. SYNTAX - STALE, corrected against the engine. This file used to say Risu's CBS is [[name]] and
 *     that scanMacroTokens is therefore blind to it. The evidence was that cbs_docs.cbs writes its
 *     EXAMPLES that way, which is a fact about the doc file, not the parser - and the reason for it
 *     is that the doc is itself CBS, so real braces would be expanded when it renders. RisuAI's
 *     parser dispatches on `{` followed by `{` or `#` (src/ts/parser/parser.svelte.ts) and its own
 *     test suite is written in {{...}}. The dialect is the same shape as the others.
 *  2. COLLISIONS - STILL TRUE, and the reason Risu is a reference rather than a translation target.
 *     Names shared with Lumiverse that mean something else are the {{random::a::b}} trap repeated,
 *     and name-level checks cannot see it. The catalog is generated from a source that carries no
 *     operation vocabulary, so RISU_MACRO_GROUPS has no `op` annotations at all; until it does,
 *     macroGroupsForDialect serves it and PresetWriteForProfile does not.
 *
 * SILLYTAVERN IS HERE TWICE, ON PURPOSE, because it really is two engines.
 * `power_user.experimental_macro_engine` - default true since 1.17.0 - chooses between the regex
 * table in public/scripts/macros.js and the MacroRegistry in public/scripts/macros/. `sillytavern`
 * documents the first, `sillytavern-new` the second, and both are true at once for different
 * installs.
 *
 * IT IS NOT A COMPATIBILITY SPLIT, and that was measured rather than assumed: the registry engine
 * resolves {{roll:1d6}} and {{roll::1d6}}, {{random:x,y}} and {{random::x::y}}, verified by running
 * both through the real 1.18.0 engine. `exampleUsage` states a canonical form, not the only accepted
 * one. What the second catalog buys is the 28 macros that exist ONLY in the registry - the
 * indexed-variable family, the instruct family, {{maxcontext}}, {{chardescription}} - which a legacy
 * install genuinely does not have.
 *
 * The write-for lens stays single. `sillytavern-new` is a reference dialect like Risu, so nothing
 * here claims a preset can be authored for one engine mode rather than the other.
 *
 * Agnai is not this shape at all - it is a template system of named slots (system/history/post) -
 * so it has no macro library to publish here. Ground truth if that changes:
 * agnai/common/template-parser.ts.
 */
import type { PresetWriteForProfile } from "../capabilities";
import type { MacroGroup } from "./types";
import { ROLECALL_MACRO_GROUPS } from "./rolecall";
import { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
import { MARINARA_MACRO_GROUPS } from "./marinara";
import { LUMIVERSE_MACRO_GROUPS } from "./lumiverse";
import { RISU_MACRO_GROUPS } from "./risu";
import { SILLYTAVERN_NEW_MACRO_GROUPS } from "./sillytavern-new";

export type { MacroEntry, MacroGroup } from "./types";
export { ROLECALL_MACRO_GROUPS } from "./rolecall";
export { SILLYTAVERN_MACRO_GROUPS } from "./sillytavern";
export { MARINARA_MACRO_GROUPS } from "./marinara";
export { LUMIVERSE_MACRO_GROUPS } from "./lumiverse";
export { RISU_MACRO_GROUPS } from "./risu";
export { SILLYTAVERN_NEW_MACRO_GROUPS } from "./sillytavern-new";

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

/**
 * Every engine whose macro dialect we can DOCUMENT, which is a wider set than the ones a preset can
 * be authored FOR.
 *
 * A SUPERTYPE, DELIBERATELY, rather than five more entries in PresetWriteForProfile. That type
 * carries real weight elsewhere - the Workbench's Write-for control, transfer-check, coverage claims,
 * platform-parity - and adding Risu to it would assert "you can author a preset for Risu", which is
 * a far larger claim than "here is Risu's macro list". The two questions are genuinely different and
 * this is the one the macro reference asks.
 *
 * Widening a PARAMETER is backward compatible: every existing caller passes a PresetWriteForProfile,
 * which is still accepted, and nothing that took the narrow type has to change.
 */
export type MacroDialect = PresetWriteForProfile | "risu" | "sillytavern-new";

export const MACRO_DIALECTS: readonly MacroDialect[] = [
  "rolecall",
  "sillytavern",
  "sillytavern-new",
  "marinara",
  "lumiverse",
  "risu",
];

export const MACRO_DIALECT_LABELS: Record<MacroDialect, string> = {
  full: "Hoplight",
  rolecall: "RoleCall",
  sillytavern: "SillyTavern",
  "sillytavern-new": "SillyTavern (new engine)",
  marinara: "Marinara",
  lumiverse: "Lumiverse",
  risu: "RisuAI",
};

/**
 * Which dialects can be a TRANSLATION target, as opposed to a reference.
 *
 * Translation joins engine to engine through the canonical operations in ./ops.ts, so a catalog with
 * no `op` annotations cannot participate: every answer would come from name matching alone, which is
 * exactly the check that calls {{random::a::b}} portable between engines that disagree about it.
 * Risu's catalog is generated from a source with no operation vocabulary, so it is absent here until
 * somebody annotates its divergences by reading the parser.
 */
export const canTranslate = (dialect: MacroDialect): dialect is PresetWriteForProfile =>
  dialect !== "risu" && dialect !== "sillytavern-new";

/** The macro groups a dialect publishes. Accepts every write-for lens, plus the reference-only ones. */
export function macroGroupsForDialect(dialect: MacroDialect): MacroGroup[] {
  if (dialect === "risu") return RISU_MACRO_GROUPS;
  if (dialect === "sillytavern-new") return SILLYTAVERN_NEW_MACRO_GROUPS;
  return macroGroupsForProfile(dialect);
}
