/**
 * Macro capability questions, answered against each engine's real catalog. The catalogs exist so any
 * surface can ask "will this survive on that host?" - the editor sidebar is only the first caller;
 * the converter is the one that matters (flagging macros that die on export is vaud's whole thesis).
 *
 * HONEST LIMIT, read before trusting these: every answer here is NAME-level. A name existing on an
 * engine does NOT mean the same syntax or meaning - {{trim}} takes an argument on RoleCall and none
 * on SillyTavern, and {{random::a::b}} is a range on RoleCall but a list pick on SillyTavern. So
 * `unsupportedIn` is a reliable "this definitely dies" list, never a clean bill of health. For the
 * real form, read the entry `findMacro` hands back.
 *
 * SECOND LIMIT: this assumes the {{...}} dialect and one canonical name per macro, which holds for
 * the four preset lenses and NOT beyond them. Risu/Lumiverse CBS documents [[name]] and aliases 77
 * of its 187 macros; scanMacroTokens would see none of it and macroName would call valid aliases
 * dead. The PresetWriteForProfile type is what keeps callers out - do not widen it without growing
 * the model. See ./index.ts.
 */
import type { PresetWriteForProfile } from "../capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../capabilities";
import type { MacroEntry } from "./types";
import { macroGroupsForProfile } from "./index";

/** Every {{token}} in a chunk of prompt text, in source order, duplicates kept. */
export function scanMacroTokens(text: string): string[] {
  return [...text.matchAll(/\{\{[^{}]*\}\}/g)].map((m) => m[0]);
}

/**
 * The bare NAME a token invokes, lowercased: {{getvar::mood}} -> getvar, {{roll:1d6}} -> roll,
 * {{time_UTC-4}} -> time_utc, {{/uppercase}} -> uppercase. Returns "" for forms that invoke no
 * name ({{// note}}, RoleCall's {{.x}} / {{$x}} shorthands, {{\n}}).
 */
export function macroName(token: string): string {
  const inner = token.replace(/^\{\{/, "").replace(/\}\}$/, "").trim().replace(/^\//, "");
  return (/^[A-Za-z_][A-Za-z0-9_]*/.exec(inner)?.[0] ?? "").toLowerCase();
}

const namesCache = new Map<PresetWriteForProfile, ReadonlySet<string>>();

/** Every macro name the profile's engine advertises. */
export function supportedMacroNames(profile: PresetWriteForProfile): ReadonlySet<string> {
  const hit = namesCache.get(profile);
  if (hit) return hit;
  const names = new Set(
    macroGroupsForProfile(profile)
      .flatMap((g) => g.macros)
      .map((m) => macroName(m.macro))
      .filter(Boolean),
  );
  namesCache.set(profile, names);
  return names;
}

/** Does this engine have a macro by that name? Name-level only - see the file header. */
export function isMacroSupported(profile: PresetWriteForProfile, token: string): boolean {
  const name = macroName(token);
  if (!name) return true; // comments/shorthands invoke nothing; never flag them as dead
  return supportedMacroNames(profile).has(name);
}

/** The catalog entry for a token on that engine, so callers can show its REAL form. */
export function findMacro(profile: PresetWriteForProfile, token: string): MacroEntry | null {
  const name = macroName(token);
  if (!name) return null;
  for (const g of macroGroupsForProfile(profile)) {
    for (const m of g.macros) if (macroName(m.macro) === name) return m;
  }
  return null;
}

/**
 * Macros in this text that the target engine has NO macro of that name for, deduped, in source
 * order. These will not resolve on that host. A token's ABSENCE from this list is not a promise it
 * behaves the same there.
 */
export function unsupportedIn(text: string, profile: PresetWriteForProfile): string[] {
  const seen = new Set<string>();
  const dead: string[] = [];
  for (const tok of scanMacroTokens(text)) {
    if (seen.has(tok) || isMacroSupported(profile, tok)) continue;
    seen.add(tok);
    dead.push(tok);
  }
  return dead;
}

/** Which lenses carry a macro of this name. Use to explain what a token costs you on export. */
export function macroSupport(token: string): PresetWriteForProfile[] {
  return PRESET_WRITE_FOR_PROFILES.filter((p) => {
    const name = macroName(token);
    return name ? supportedMacroNames(p).has(name) : false;
  });
}
