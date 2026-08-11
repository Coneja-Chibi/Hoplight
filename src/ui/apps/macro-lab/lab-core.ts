/**
 * The Macro Lab's reading half: what the catalogs know about a piece of macro text.
 *
 * Pure, and separate from the engine half on purpose. These two answer different questions and one
 * of them is not available on most machines:
 *
 *   READING is our model of the macro - name, meaning, which of the five lenses carry it, what it
 *   becomes elsewhere. Instant, offline, every dialect, and it is a CATALOG's answer, transcribed
 *   from each engine's own capability source. It can be out of date; it cannot be out of reach.
 *
 *   RESOLVING is the engine's answer, and only two engines can be driven from here at all.
 *
 * A surface that blurs them would be inventing values, so the screen keeps them apart and this file
 * never touches the network.
 *
 * Nothing here re-implements the lexer. The brace walk lives in core/preset/macros/support.ts and is
 * consumed through scanMacroTree, so a fix to nesting or to unmatched openers reaches this too.
 */
import type { PresetWriteForProfile } from "../../../core/preset/capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../../../core/preset/capabilities";
import {
  findMacro,
  macroName,
  scanMacroTree,
  supportedMacroNames,
} from "../../../core/preset/macros/support";
import { translateText, type MacroChangeKind } from "../../../core/preset/macros/translate";

/**
 * What the catalog can say about one token.
 *
 * "invokes-nothing" is its own answer and NOT a quiet pass. `{{// a note}}`, `{{\n}}`, RoleCall's
 * `{{.x}}` and Lumiverse's flag prefixes all name no macro, so `isMacroSupported` answers true for
 * them by design - it fails lenient so a compatibility check never calls working text dead. Carrying
 * that leniency onto a screen would print a tick beside a comment and claim the engine has a macro
 * called nothing. A reader deserves the real reason.
 */
export type MacroVerdict = "known" | "unknown" | "invokes-nothing";

export interface MacroReading {
  /** the token exactly as it was typed */
  readonly token: string;
  /** the bare name it invokes, lowercased; "" when it invokes none */
  readonly name: string;
  /** 0 for a token in the text, 1 for one inside an argument, and so on */
  readonly depth: number;
  readonly verdict: MacroVerdict;
  /** the catalog's own words for this macro on this lens */
  readonly description?: string;
  readonly example?: string;
  /**
   * The form this engine documents, when it differs from what was typed. Separators are the usual
   * culprit and the usual silent failure: `{{roll:1d6}}` and `{{roll::2d6}}` are the same name and
   * not the same macro.
   */
  readonly documentedAs?: string;
}

export interface LabReading {
  readonly tokens: readonly MacroReading[];
  /** distinct names this lens has nothing for, in source order; the list worth acting on */
  readonly unknownNames: readonly string[];
  /** true when the text carries no {{...}} at all, which is a different thing from carrying none we know */
  readonly empty: boolean;
}

/** Read a piece of text through one lens's catalog. */
export function readMacros(text: string, lens: PresetWriteForProfile): LabReading {
  const scanned = scanMacroTree(text);
  const known = supportedMacroNames(lens);
  const tokens: MacroReading[] = [];
  const unknown: string[] = [];

  for (const { token, depth } of scanned) {
    const name = macroName(token);
    if (!name) {
      tokens.push({ token, name: "", depth, verdict: "invokes-nothing" });
      continue;
    }
    const entry = findMacro(lens, token);
    if (!entry || !known.has(name)) {
      tokens.push({ token, name, depth, verdict: "unknown" });
      if (!unknown.includes(name)) unknown.push(name);
      continue;
    }
    tokens.push({
      token,
      name,
      depth,
      verdict: "known",
      description: entry.description,
      ...(entry.example ? { example: entry.example } : {}),
      ...(entry.macro !== token ? { documentedAs: entry.macro } : {}),
    });
  }

  return { tokens, unknownNames: unknown, empty: scanned.length === 0 };
}

/** What one token becomes on another lens. */
export interface TravelRow {
  readonly lens: PresetWriteForProfile;
  /** the token as that engine would need it written, or null when nothing carries it across */
  readonly becomes: string | null;
  /** the translator's own reason, in its words */
  readonly why: string;
  readonly kind: MacroChangeKind;
}

/**
 * Where a token can go from here, one row per other lens.
 *
 * Asked of the TRANSLATOR rather than of two catalogs, because a name existing on both ends is not
 * the same as the macro surviving: `{{random::a::b}}` is a list pick on SillyTavern and a numeric
 * range on RoleCall, and the translator is the only thing here that models the difference. Answering
 * from name-presence alone would print "travels fine" over the exact case that silently does not.
 */
export function travelFor(token: string, from: PresetWriteForProfile): TravelRow[] {
  const rows: TravelRow[] = [];
  for (const lens of PRESET_WRITE_FOR_PROFILES) {
    if (lens === from) continue;
    const out = translateText(token, from, lens, "lab");
    const change = out.changes[0];
    if (!change) {
      // No recorded change means the translator carried it through as written.
      rows.push({ lens, becomes: out.text, why: "the same token works there", kind: "same" });
      continue;
    }
    rows.push({ lens, becomes: change.to, why: change.why, kind: change.kind });
  }
  return rows;
}

/** The lenses, in the order the picker shows them. */
export const LAB_LENSES: readonly PresetWriteForProfile[] = PRESET_WRITE_FOR_PROFILES;

/**
 * The lens that is a DIALECT rather than a host.
 *
 * "Hoplight" is offered because people really do author against the canonical superset - but no
 * Hoplight engine exists. macros/index.ts is explicit: vaud has no runtime of its own, so the `full`
 * catalog IS RoleCall's, chosen to avoid inventing a dialect nothing runs. Everything this screen
 * says about a lens therefore has to be qualified for this one, or the reading half quietly claims a
 * host: "in this engine's catalog" names an engine that does not exist, and a travel row reading
 * "the same token works there" is a portability promise about nowhere.
 *
 * Kept in the picker and labelled, rather than dropped. Someone writing canonical macros needs the
 * reference; what they must not be given is the impression that something will run it.
 */
export const DIALECT_ONLY_LENS: PresetWriteForProfile = "full";

/** True when this lens describes a dialect nobody executes. */
export const isDialectOnly = (lens: PresetWriteForProfile): boolean => lens === DIALECT_ONLY_LENS;

/** What the reading half must add when the chosen lens has no engine behind it anywhere. */
export const DIALECT_ONLY_NOTE =
  "Hoplight is the canonical superset dialect, not a program that runs macros. Its catalog is "
  + "RoleCall's, because inventing a dialect nothing executes would be worse. Nothing can resolve "
  + "text for this lens - pick the platform you are actually writing for to see that.";

/** One pretend variable as the panel holds it: a row that may be half-typed or blank. */
export interface VarRow {
  readonly key: string;
  readonly value: string;
}

/** Everything the person filled in on the left, before it becomes a request. */
export interface LabContext {
  readonly user: string;
  readonly char: string;
  readonly vars: readonly VarRow[];
}

/**
 * Turn the panel into the request the engine route takes.
 *
 * PURE, AND SEPARATE FROM THE COMPONENT ON PURPOSE. This is where a name someone typed becomes
 * something an engine is told, so every rule about it - an untyped field means "keep your own
 * default", a blank variable row is not a variable, whitespace around a name is not part of it -
 * is a rule worth proving rather than reading. It also cannot be proven through the component:
 * react-dom decides at import time whether it can use `input` events, and in this suite it is first
 * imported before any document exists, so a simulated keystroke never reaches an onChange handler.
 * Putting the rules here is what keeps them tested instead of merely written.
 *
 * OMITTED, NOT EMPTIED. An absent `identity` lets each adapter keep its own placeholder; sending
 * `{ user: "" }` would name somebody the empty string, and `{{user}}` would resolve to nothing at
 * all. The two are very different answers and only one of them is what a blank field means.
 */
export function buildResolveAsk(
  engineId: string,
  text: string,
  ctx: LabContext,
): { engine: string; text: string; state?: Record<string, string>; identity?: { user?: string; char?: string } } {
  const identity: { user?: string; char?: string } = {};
  if (ctx.user.trim()) identity.user = ctx.user.trim();
  if (ctx.char.trim()) identity.char = ctx.char.trim();

  const state: Record<string, string> = {};
  for (const row of ctx.vars) {
    const key = row.key.trim();
    // A row with no name is a row somebody has not finished typing, not a variable called "".
    // The VALUE is passed exactly as written: a variable deliberately set to empty is a real case.
    if (key) state[key] = row.value;
  }

  return {
    engine: engineId,
    text,
    ...(Object.keys(state).length > 0 ? { state } : {}),
    ...(Object.keys(identity).length > 0 ? { identity } : {}),
  };
}

/**
 * How a verdict reads on screen. Here rather than in the component so the wording is asserted by a
 * test: these three strings are the whole of what a reader is told about our confidence.
 */
export const VERDICT_LABEL: Record<MacroVerdict, string> = {
  known: "in this engine's catalog",
  unknown: "no macro of this name here",
  "invokes-nothing": "invokes no macro",
};

/**
 * The verdict as this lens may honestly state it.
 *
 * "In this engine's catalog" names an engine, and the canonical lens has none - so for that one the
 * same finding has to be worded as what it is, a dialect entry.
 */
export const verdictLabel = (verdict: MacroVerdict, lens: PresetWriteForProfile): string => {
  if (!isDialectOnly(lens)) return VERDICT_LABEL[verdict];
  if (verdict === "known") return "in the canonical dialect";
  if (verdict === "unknown") return "not in the canonical dialect";
  return VERDICT_LABEL[verdict];
};
