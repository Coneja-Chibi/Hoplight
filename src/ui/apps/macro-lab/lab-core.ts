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
import { PRESET_WRITE_FOR_PROFILES } from "../../../core/preset/capabilities";
import {
  canTranslate,
  macroGroupsForDialect,
  MACRO_DIALECTS,
  MACRO_DIALECT_LABELS,
  type MacroDialect,
  type MacroEntry,
  type MacroGroup,
} from "../../../core/preset/macros";
import { opFamily, type MacroOp } from "../../../core/preset/macros/ops";
import {
  findMacro,
  macroName,
  scanMacroTree,
  supportedMacroNames,
} from "../../../core/preset/macros/support";
import { translateText, type MacroChangeKind } from "../../../core/preset/macros/translate";

/**
 * The platforms this screen offers: every engine whose macro dialect we can document.
 *
 * A DIFFERENT AXIS FROM THE WRITE-FOR LENSES, in both directions.
 *
 * `full` is absent. It is the canonical superset lens the Workbench needs so a preset can be
 * authored without committing to a host - but its catalog IS RoleCall's, because vaud has no runtime
 * and inventing a dialect nothing executes would be worse. Here it was a button labelled "Hoplight"
 * showing RoleCall's macro list under a verdict naming an engine that does not exist.
 *
 * RisuAI is present, and is not a write-for lens. A person can read Risu's macro reference without
 * Hoplight claiming it can author a preset for Risu - see MacroDialect.
 */
export const LAB_LENSES: readonly MacroDialect[] = MACRO_DIALECTS;

/**
 * Can this dialect answer "what does my token become over there"?
 *
 * Only the ones the translator models. Risu's generated catalog carries no operation annotations, so
 * every cross-engine answer for it would come from name matching alone - which is precisely the
 * check that calls {{random::a::b}} portable between engines that disagree about what it means.
 * Re-exported here so the panes ask one question rather than testing for a string.
 */
export const dialectTranslates = canTranslate;

/**
 * Said on screen wherever a reference-only dialect would otherwise show an empty answer.
 *
 * PER DIALECT, because there are two reasons and naming the wrong one is its own false claim. A
 * catalog with no operation annotations cannot be translated at all; a catalog that mirrors another
 * engine's macros is perfectly well modelled and simply is not a separate destination - a preset is
 * authored for SillyTavern, not for one of its two macro engines.
 */
export function noTranslationNote(lens: MacroDialect): string {
  const annotated = macroGroupsForDialect(lens).flatMap((g) => g.macros).some((m) => m.op);
  if (annotated) {
    return "This is one of SillyTavern's two macro engines, and a preset is written for "
      + "SillyTavern rather than for one of them - so there is nothing to convert it into. Switch "
      + "to SillyTavern to see where a macro travels.";
  }
  return `Hoplight does not yet model how ${MACRO_DIALECT_LABELS[lens]}'s macros map onto the `
    + "other engines, so it cannot tell you what this becomes elsewhere. Its catalog carries no "
    + "operation annotations, and answering from names alone is what makes a macro look portable "
    + "when it is not.";
}

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
export function readMacros(text: string, lens: MacroDialect): LabReading {
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
  readonly lens: MacroDialect;
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
export function travelFor(token: string, from: MacroDialect): TravelRow[] {
  // A dialect the translator does not model can neither be a source nor a target: see
  // NO_TRANSLATION_NOTE, which the pane shows in place of an empty list.
  if (!canTranslate(from)) return [];
  const rows: TravelRow[] = [];
  // LAB_LENSES, not every write-for profile: a "Hoplight" row would repeat RoleCall's answer under
  // a name with no engine behind it. See LAB_LENSES.
  for (const lens of LAB_LENSES) {
    if (lens === from || !canTranslate(lens)) continue;
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
 * The columns the operations table can honestly carry.
 *
 * A DIALECT WITH NO OPERATION ANNOTATIONS CANNOT APPEAR HERE, and adding it anyway would be the
 * loudest possible false claim: RisuAI plainly has randomness, conditionals and text shaping, so a
 * RisuAI column reading "none" down all 21 rows would assert it can do none of them. The absence of
 * an annotation is a gap in OUR model, and a table that renders our gaps as the engine's is worse
 * than a table that leaves the engine out and says so.
 *
 * The way in is to annotate Risu's divergences by reading its parser, per entry - the same pass
 * every other catalog had. Until then the bible carries Risu and this does not.
 */
export const OPERATION_LENSES: readonly MacroDialect[] = LAB_LENSES.filter(canTranslate);

/**
 * Dialects with no column, split by WHY, because the two reasons are not the same fact.
 *
 * `unmapped` has no operation annotations at all, so a column would be "none" down every row and
 * would read as the engine being incapable. `duplicate` is annotated but would repeat another
 * dialect's column exactly - SillyTavern's two engines share their macros' operations, so a second
 * identical column teaches nothing and implies a difference that is not there.
 */
export const OPERATION_ABSENT: {
  readonly unmapped: readonly MacroDialect[];
  readonly duplicate: readonly MacroDialect[];
} = (() => {
  const unmapped: MacroDialect[] = [];
  const duplicate: MacroDialect[] = [];
  for (const lens of LAB_LENSES) {
    if (canTranslate(lens)) continue;
    const annotated = macroGroupsForDialect(lens).flatMap((g) => g.macros).some((m) => m.op);
    (annotated ? duplicate : unmapped).push(lens);
  }
  return { unmapped, duplicate };
})();

/** One canonical operation, and how each platform spells it. */
export interface OperationRow {
  readonly op: MacroOp;
  /** the dotted family, so near neighbours group together */
  readonly family: string;
  /** every platform, in lens order; `forms` is empty for one that cannot do this at all */
  readonly byLens: readonly { lens: MacroDialect; forms: readonly MacroEntry[] }[];
  /** how many platforms have it, so the gaps can be sorted to where they get read */
  readonly carriedBy: number;
}

/**
 * The operations table: what each engine calls the same idea, and where nobody has one.
 *
 * DERIVED FROM THE CATALOGS, NEVER WRITTEN DOWN. ops.ts defines the vocabulary and each catalog
 * annotates its own entries; a hand-kept table of the join would be a second authority that goes
 * stale the first time a catalog gains an entry, which is the failure this repo's hub-and-spoke
 * macro model exists to avoid in the first place.
 *
 * THE EMPTY CELLS ARE THE POINT. "SillyTavern has no macro for this operation" is the thing that
 * tells somebody their prompt will not survive the move - a table showing only what exists reads as
 * universal coverage. Rows are ordered by how many platforms carry them, gaps first, so the
 * portability problems are at the top rather than buried alphabetically.
 *
 * ONLY ANNOTATED ENTRIES APPEAR, and that is honest rather than partial: ops.ts is explicit that
 * annotation is for divergence, not completeness, so the ~74 names that already agree across engines
 * carry no op and belong in the macro bible instead. This table answers "where do the engines
 * disagree", which is a different question from "what macros are there".
 */
export function operationRows(): OperationRow[] {
  const seen = new Map<MacroOp, Map<MacroDialect, MacroEntry[]>>();
  for (const lens of OPERATION_LENSES) {
    for (const group of macroGroupsForDialect(lens)) {
      for (const entry of group.macros) {
        if (!entry.op) continue;
        let perLens = seen.get(entry.op);
        if (!perLens) {
          perLens = new Map<MacroDialect, MacroEntry[]>();
          seen.set(entry.op, perLens);
        }
        const forms = perLens.get(lens) ?? [];
        forms.push(entry);
        perLens.set(lens, forms);
      }
    }
  }

  const rows: OperationRow[] = [];
  for (const [op, perLens] of seen) {
    const byLens = OPERATION_LENSES.map((lens) => ({ lens, forms: perLens.get(lens) ?? [] }));
    rows.push({
      op,
      family: opFamily(op),
      byLens,
      carriedBy: byLens.filter((c) => c.forms.length > 0).length,
    });
  }
  // Gaps first, then families together, so a reader scanning for trouble finds it immediately.
  return rows.sort((a, b) => a.carriedBy - b.carriedBy || a.op.localeCompare(b.op));
}

/** Where a token goes when somebody clicks it in the bible, and what the text becomes. */
export interface Insertion {
  readonly text: string;
  /** where the caret belongs afterwards: just past what was inserted */
  readonly caret: number;
}

/**
 * Insert a token into the scratch text at the caret, replacing any selection.
 *
 * PURE, BECAUSE THE COMPONENT CANNOT PROVE THIS. Insertion arithmetic is exactly the kind of thing
 * that is wrong at the edges - caret at 0, caret at the end, a selection spanning the whole box, a
 * stale caret past the end of a shortened text - and none of it can be exercised through the
 * component, since react-dom in this suite never delivers onChange for a text field (see
 * buildResolveAsk).
 *
 * Out-of-range positions are clamped rather than refused. A caret index can legitimately be stale by
 * the time a click lands, and appending is a far better answer to that than throwing away what
 * somebody just asked for.
 */
export function insertToken(
  text: string,
  token: string,
  selectionStart: number,
  selectionEnd: number,
): Insertion {
  const clamp = (n: number): number => Math.max(0, Math.min(text.length, Math.trunc(n) || 0));
  const lo = Math.min(clamp(selectionStart), clamp(selectionEnd));
  const hi = Math.max(clamp(selectionStart), clamp(selectionEnd));
  return {
    text: `${text.slice(0, lo)}${token}${text.slice(hi)}`,
    caret: lo + token.length,
  };
}

/**
 * Every macro this platform has, grouped the way its catalog groups them.
 *
 * A thin pass-through today, and named anyway: the bible pane should ask "what does this platform
 * have" rather than reach into core's catalog layout, so a change to how catalogs are organised
 * lands in one place instead of inside a component.
 */
export function bibleFor(lens: MacroDialect): MacroGroup[] {
  return macroGroupsForDialect(lens);
}

/** How many macros a platform publishes, counting aliases as the one macro they alias. */
export const bibleSize = (lens: MacroDialect): number =>
  bibleFor(lens).reduce((n, group) => n + group.macros.length, 0);

/**
 * The bible narrowed to what somebody is looking for.
 *
 * NEEDED, NOT ORNAMENTAL: Lumiverse publishes 238 macros and RoleCall 176, so an unfiltered wall of
 * pills is a reference nobody reads. Matching covers the token, its description and its aliases,
 * because "the one that gives me the character's name" is how people actually search - the name is
 * the thing they do not know yet.
 *
 * Groups that end up empty are dropped rather than shown as empty headings.
 */
export function filterBible(groups: readonly MacroGroup[], query: string): MacroGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups as MacroGroup[];
  const hit = (entry: MacroEntry): boolean =>
    entry.macro.toLowerCase().includes(needle)
    || entry.description.toLowerCase().includes(needle)
    || (entry.aliases ?? []).some((a) => a.toLowerCase().includes(needle));
  return groups
    .map((group) => ({ ...group, macros: group.macros.filter(hit) }))
    .filter((group) => group.macros.length > 0);
}
