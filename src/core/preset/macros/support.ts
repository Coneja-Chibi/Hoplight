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
 * SECOND LIMIT: this assumes the {{...}} dialect, which holds for every preset lens (the real
 * Lumiverse engine included - the [[name]] worry belonged to Risu's CBS) and NOT beyond them.
 * Aliases are modeled: supportedMacroNames/findMacro consult MacroEntry.aliases, so heavy aliasing
 * (Lumiverse has ~180 alternate names) never warns as unsupported. Lumi's prefix flag characters
 * ({{!x}}, {{#x}}...) make macroName return "", which fails lenient - flagged tokens are never
 * called dead. The PresetWriteForProfile type is what keeps Risu/Agnai callers out - do not widen
 * it without growing the model. See ./index.ts.
 */
import type { PresetWriteForProfile } from "../capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../capabilities";
import type { MacroEntry } from "./types";
import { macroGroupsForProfile } from "./index";

/**
 * Every {{token}} in a chunk of prompt text, in source order, duplicates kept. Nested arguments are
 * returned too, each outer token immediately before the tokens inside it.
 *
 * THIS USED TO BE `/\{\{[^{}]*\}\}/g`, WHICH SILENTLY LOST EVERY NESTED CONSTRUCT. That character
 * class cannot cross a brace, so any macro carrying a macro argument was invisible to every check
 * built on this: `{{if::{{getvar::x}}::yes::no}}` reported only `getvar`, and
 * `{{random::{{char}}::b}}` reported only `char` while the `random` that actually differs between
 * engines went unseen. Blocks were hit hardest, because a Lumiverse or RoleCall condition is very
 * often a nested lookup. Under-reporting here reads as "nothing dies", which is the worst direction
 * for a compatibility check to be wrong in.
 *
 * Depth counting matches the lexer contract in specs/engine/macro-engine.md: only `{{` and `}}`
 * move depth, a lone brace is ordinary text, and an unmatched `{{` degrades to literal text rather
 * than throwing. This scans and slices only. It never evaluates anything.
 */
export function scanMacroTokens(text: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{{", index);
    if (open === -1) break;
    const close = matchingClose(text, open);
    if (close === -1) break; // unmatched opener: the remainder is literal text
    const token = text.slice(open, close + 2);
    tokens.push(token);
    // Recurse into the argument text so a nested macro is reported as well as its container.
    tokens.push(...scanMacroTokens(text.slice(open + 2, close)));
    index = close + 2;
  }
  return tokens;
}

/** Index of the `}}` closing the `{{` at `open`, or -1 when the text never closes it. */
export function matchingClose(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length - 1; i += 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (text[i] === "}" && text[i + 1] === "}") {
      depth -= 1;
      if (depth === 0) return i;
      i += 1;
    }
  }
  return -1;
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
      .flatMap((m) => [macroName(m.macro), ...(m.aliases ?? []).map((a) => a.toLowerCase())])
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
    for (const m of g.macros) {
      if (macroName(m.macro) === name) return m;
      if (m.aliases?.some((a) => a.toLowerCase() === name)) return m;
    }
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

/**
 * How one array element is named inside a body path.
 *
 * A finding reading `prompts[17].content` tells a reader almost nothing; `prompts.Director Resolve
 * .content` tells them which block to open. Authored collections - prompt blocks, lorebook entries,
 * greetings - carry a human name, so the walk prefers it and falls back to the index only when
 * there is nothing better. Shared so the checker and the translator can never disagree about where
 * a token lives.
 */
export function pathSegment(item: unknown, index: number): string {
  if (item !== null && typeof item === "object") {
    const row = item as Record<string, unknown>;
    for (const key of ["name", "title", "label", "comment", "id"]) {
      const value = row[key];
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
  }
  return String(index);
}
