/**
 * The canonical macro vocabulary: the hub every engine's macro dialect maps into.
 *
 * WHY THIS EXISTS. A directed table keyed "rolecall>sillytavern" would be a format-to-format
 * conversion, which project rule 1 forbids, and for the same reason it forbids one between codecs:
 * five engines is twenty directed pairs, so each new engine would multiply the work instead of
 * adding to it. Macros get the same hub and spoke the formats already use. Each catalog declares
 * what its OWN macro means; every cross-engine answer is derived by joining on that meaning. Adding
 * an engine is one annotation pass and every direction appears for free.
 *
 * An op is a SEMANTIC identity, not a name, which is what makes the hard cases fall out instead of
 * being remembered by hand: RoleCall's two-argument `{{random::min::max}}` carries `random.range`
 * while SillyTavern's `{{random::a::b}}` carries `random.pick`. Same spelling, different op, so the
 * collision is computed. Nobody writes it down.
 *
 * OPS ARE ATTACHED PER ENTRY, NOT PER NAME, because a single name can mean different things at
 * different argument counts. RoleCall's own handler documents `{{random}}` as 0-100, `{{random::min::max}}`
 * as a range and `{{random::a::b::c}}` as a pick. Annotating the name would flag the three-argument
 * form as a collision when it is perfectly portable.
 *
 * ANNOTATION IS INTENTIONALLY PARTIAL. An entry with no op falls back to name matching, which is
 * correct for the 74 shared names that already agree across engines. Ops are only needed where a
 * name would lie. Do not backfill for completeness; annotate divergence.
 *
 * This file is pure vocabulary and shape arithmetic. The cross-engine join lives in ./equivalence.ts
 * so nothing here has to know a catalog exists.
 */

/** Canonical operations, dotted `family.action` so a family can offer near neighbours. */
export type MacroOp =
  // Randomness: the family that collides most.
  | "random.pick"
  | "random.pick-sticky"
  | "random.range"
  | "dice.roll"
  // Text shaping: two unrelated behaviours are both called "trim".
  | "text.trim-argument"
  | "text.trim-surrounding"
  | "text.reverse"
  | "text.wordcount"
  | "text.join"
  | "random.shuffle"
  // Two engines count tokens of DIFFERENT things: the whole prompt, or a given string.
  | "text.tokencount-argument"
  | "prompt.tokencount"
  // Time.
  | "time.format"
  | "time.now"
  | "time.diff"
  // Card and identity fields.
  | "char.creator"
  | "char.creator-notes"
  | "char.first-message"
  | "chat.message-count"
  | "chat.memories"
  // Control flow.
  | "flow.conditional"
  // Generation controls.
  | "gen.banned"
  // Presentation: engine product surface with no portable meaning.
  | "theme.accent-color"
  | "theme.palette"
  | "theme.gradient";

/** The family prefix, used to offer near neighbours when no engine has the exact op. */
export const opFamily = (op: MacroOp): string => op.split(".")[0] ?? op;

/** How an engine spells arguments. Derived from a catalog form, never hand-annotated. */
export type ArgSeparator = "::" | ":" | " " | "none";

const innerOf = (macro: string): string =>
  macro.replace(/^\{\{/, "").replace(/\}\}$/, "").replace(/^[#/!?~>]/, "");

/** Read the argument separator out of a catalog entry's own example form. */
export function separatorOf(macro: string): ArgSeparator {
  const inner = innerOf(macro);
  if (inner.includes("::")) return "::";
  if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(inner)) return ":";
  if (/^[A-Za-z_][A-Za-z0-9_]*\s+\S/.test(inner)) return " ";
  return "none";
}

/**
 * How many arguments a catalog form documents. `{{char}}` is 0, `{{roll::NdM}}` is 1,
 * `{{random::min::max}}` is 2. A comma-list form such as `{{random:a,b,c}}` is variadic, reported
 * as null, because the engine takes as many as you give it.
 */
export function arityOf(macro: string): number | null {
  const inner = innerOf(macro);
  const separator = separatorOf(macro);
  switch (separator) {
    case "::": {
      const parts = inner.split("::");
      // A trailing "..." or a three-part example both signal "and so on".
      return /\.\.\./.test(inner) || parts.length > 3 ? null : parts.length - 1;
    }
    case ":": {
      const rest = inner.slice(inner.indexOf(":") + 1);
      return rest.includes(",") || /\.\.\./.test(rest) ? null : 1;
    }
    case " ": {
      const rest = inner.slice(inner.indexOf(" ") + 1).trim();
      return rest.length === 0 ? 0 : null; // space forms are free-form text
    }
    default:
      return 0;
  }
}

/** Does a form documented with this arity accept a call carrying `count` arguments? */
export function arityAccepts(formArity: number | null, count: number): boolean {
  return formArity === null ? true : formArity === count;
}

/**
 * Rebuild a token in the target engine's spelling. The name comes from the TARGET's own form, so an
 * engine that calls the same operation something else still gets its own name and punctuation.
 */
export function renderToken(targetMacro: string, args: readonly string[]): string {
  const inner = innerOf(targetMacro);
  const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(inner)?.[0] ?? inner;
  if (args.length === 0) return `{{${name}}}`;
  switch (separatorOf(targetMacro)) {
    case "::":
      return `{{${name}::${args.join("::")}}}`;
    case ":":
      return `{{${name}:${args.join(",")}}}`;
    case " ":
      return `{{${name} ${args.join(" ")}}}`;
    default:
      // The target's form takes no arguments. Emitting them would be a syntax error on that host,
      // so the bare form is the honest projection and the caller records what was lost.
      return `{{${name}}}`;
  }
}
