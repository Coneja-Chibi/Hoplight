/**
 * The full replacement grammar in one module (REGEX-JEWEL-PLAN.md Phase R2X). Pure: no eval, no
 * I/O, no clock/random. This is the single home for everything that turns a matched rule + its
 * `replace` template into output text, so apply.ts can delegate here in the next wave (it is NOT
 * wired yet - this phase only extracts + extends and keeps the exported surface clean).
 *
 * Grammar (per match):
 *   $$              -> a literal "$"
 *   $&, {{match}}   -> the whole match (case-insensitive sugar); trimStrings applied
 *   $`              -> the text BEFORE the match (prefix); no trim
 *   $'              -> the text AFTER the match (suffix); no trim
 *   $<name>         -> a named group; trimStrings applied
 *   $1..$99         -> a numbered group (native two-digit resolution); trimStrings applied
 *   \u \l           -> upper/lower the next single output code point (one-shot)
 *   \U \L ... \E    -> upper/lower a run until \E or end (PCRE/Perl case transforms)
 * A one-shot (\u/\l) OVERRIDES the active run for exactly the one code point it applies to, then
 * the run resumes - the Perl `\u\L...`/`\l\U...` rule. Case transforms are applied to EVERY emitted
 * code point, literal or substituted, so \U$1 $2\E uppercases across group boundaries.
 *
 * Tokens JS's own String.replace supports ($$, $&, $`, $', $<name>, $N) match the host engine
 * byte-for-byte (proven by the native-oracle parity tests); the extensions ({{match}} sugar, case
 * transforms, trimStrings) have no host oracle and are pinned to Perl semantics + explicit cases.
 *
 * SAFETY: applying a rule is String assembly, never eval. A `replace` template may carry HTML/CBS;
 * rendering that output happens elsewhere, only through SealedHtmlPreview.
 */
import type { RegexSubstitution } from "../../entities/regex/schema";

type CaseMode = "none" | "upper" | "lower";

export interface ExpandOptions {
  /** fragments stripped from each substituted match/group value (never from prefix/suffix/literals) */
  trimStrings?: readonly string[];
}

/** Escape every regex metacharacter in a literal string (the "escape this" primitive). */
export const escapeRegexChars = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strip every occurrence of every trim fragment from a value (RC's applyTrimStrings discipline). */
export function applyTrim(value: string, trimStrings: readonly string[]): string {
  let out = value;
  for (const t of trimStrings) {
    if (t) out = out.split(t).join("");
  }
  return out;
}

/** A `{{token}}`: no braces inside, so a stray `{{` cannot swallow the rest of the template. */
const MACRO_TOKEN = /\{\{([^{}]*)\}\}/g;

/**
 * Substitute {{key}} tokens from a flat macro map (case-insensitive); escape the substituted value
 * when `escapeValues` is set. A function replacer is used so a `$` inside a value is never itself
 * interpreted as a replacement token.
 *
 * ONE pass over the text, resolving each token against the map as it is met. The earlier
 * implementation looped over the macro entries instead, running a global replace per key, which
 * left text inserted by one key visible to every later key. That made the result depend on the
 * map's insertion order:
 *
 *   { a: "{{b}}", b: "BOOM" }  ->  "[BOOM]"    // b's pass expanded what a had just inserted
 *   { b: "BOOM", a: "{{b}}" }  ->  "[{{b}}]"   // b ran first, so a's token survived literally
 *
 * Same logical map, different output. A single pass makes the result depend only on the map's
 * contents, and means a macro VALUE can never smuggle another macro token into the result: an
 * inserted `{{b}}` is output, not input. Unknown tokens stay literal, as before.
 */
export function substituteMacros(
  text: string,
  macros: Record<string, string> | undefined,
  escapeValues: boolean,
): string {
  if (!macros) return text;
  const lookup = new Map<string, string>();
  for (const [key, value] of Object.entries(macros)) lookup.set(key.toLowerCase(), value);
  return text.replace(MACRO_TOKEN, (whole, key: string) => {
    const value = lookup.get(key.toLowerCase());
    if (value === undefined) return whole; // not ours: leave it exactly as written
    return escapeValues ? escapeRegexChars(value) : value;
  });
}

/**
 * Find-side macro substitution: "raw" substitutes values unescaped, "escaped" escapes them so a
 * value is treated as literal text inside the compiled pattern. "none" and "after" leave the find
 * pattern untouched ("after" resolves on the OUTPUT instead - see substituteAfterMacros).
 */
export function substituteFindMacros(
  find: string,
  mode: RegexSubstitution,
  macros: Record<string, string> | undefined,
): string {
  if (mode === "raw") return substituteMacros(find, macros, false);
  if (mode === "escaped") return substituteMacros(find, macros, true);
  return find;
}

/**
 * Output-side macro substitution: Lumiverse's "after" mode resolves {{key}} tokens on the finished
 * post-replacement text (a single global pass), never on the find pattern. Every other mode leaves
 * the text untouched.
 */
export function substituteAfterMacros(
  text: string,
  mode: RegexSubstitution,
  macros: Record<string, string> | undefined,
): string {
  return mode === "after" ? substituteMacros(text, macros, false) : text;
}

/**
 * Resolve a `$` followed by digits to a group index, mirroring the host engine's two-digit rule:
 * prefer the two-digit group NN when it exists, else fall back to the single-digit group N (leaving
 * the second digit as a literal), else null (the `$` and its digits stay literal, e.g. `$0`, `$9`
 * with fewer than nine groups). `pos` points at the first digit; `consumed` counts digits taken.
 */
function resolveNumberedGroup(
  template: string,
  pos: number,
  groupCount: number,
): { group: number; consumed: number } | null {
  const d1 = template[pos];
  if (d1 === undefined || d1 < "0" || d1 > "9") return null;
  const d2 = template[pos + 1];
  if (d2 !== undefined && d2 >= "0" && d2 <= "9") {
    const nn = Number(d1 + d2);
    if (nn >= 1 && nn <= groupCount) return { group: nn, consumed: 2 };
  }
  const n = Number(d1);
  if (n >= 1 && n <= groupCount) return { group: n, consumed: 1 };
  return null;
}

/**
 * Expand one rule's replacement template against ONE match, returning the text that replaces that
 * match. Prefix/suffix come from the match's own `input`/`index` (the original text at match time,
 * exactly as the host engine computes `$`` / `$'`). Deterministic and pure.
 */
export function expandReplacement(
  template: string,
  match: RegExpMatchArray,
  options?: ExpandOptions,
): string {
  const trimStrings = options?.trimStrings ?? [];
  const input = match.input ?? "";
  const start = match.index ?? 0;
  const whole = match[0] ?? "";
  const prefix = input.slice(0, start);
  const suffix = input.slice(start + whole.length);
  const groupCount = match.length - 1;
  const hasNamedGroups = match.groups !== undefined;

  let out = "";
  let runMode: CaseMode = "none";
  let oneShot: CaseMode = "none";

  // Emit text through the active case state: a one-shot overrides the run for one code point, then
  // is consumed. Iterating by code point (for...of) keeps astral characters intact. An empty string
  // consumes no one-shot, so it carries to the next real character (the Perl behavior).
  const emit = (text: string): void => {
    for (const ch of text) {
      const mode = oneShot !== "none" ? oneShot : runMode;
      out += mode === "upper" ? ch.toUpperCase() : mode === "lower" ? ch.toLowerCase() : ch;
      if (oneShot !== "none") oneShot = "none";
    }
  };

  const n = template.length;
  let i = 0;
  while (i < n) {
    const c = template[i]!;

    if (c === "\\") {
      const next = template[i + 1];
      if (next === "U") { runMode = "upper"; i += 2; continue; }
      if (next === "L") { runMode = "lower"; i += 2; continue; }
      if (next === "E") { runMode = "none"; i += 2; continue; }
      if (next === "u") { oneShot = "upper"; i += 2; continue; }
      if (next === "l") { oneShot = "lower"; i += 2; continue; }
      if (next === "\\") { emit("\\"); i += 2; continue; }
      // A lone or unknown backslash escape stays literal (no \n/\t processing - apply.ts precedent).
      emit("\\");
      i += 1;
      continue;
    }

    if (c === "$") {
      const next = template[i + 1];
      if (next === undefined) { emit("$"); i += 1; continue; }
      if (next === "$") { emit("$"); i += 2; continue; }
      if (next === "&") { emit(applyTrim(whole, trimStrings)); i += 2; continue; }
      if (next === "`") { emit(prefix); i += 2; continue; }
      if (next === "'") { emit(suffix); i += 2; continue; }
      if (next === "<") {
        // $<name> is only special when the regex actually has named groups; otherwise the host
        // engine leaves "$<...>" literal, so we do too.
        if (hasNamedGroups) {
          const close = template.indexOf(">", i + 2);
          if (close !== -1) {
            const name = template.slice(i + 2, close);
            const value = match.groups?.[name];
            emit(applyTrim(typeof value === "string" ? value : "", trimStrings));
            i = close + 1;
            continue;
          }
        }
        emit("$");
        i += 1;
        continue;
      }
      if (next >= "0" && next <= "9") {
        const resolved = resolveNumberedGroup(template, i + 1, groupCount);
        if (resolved) {
          const value = match[resolved.group];
          emit(applyTrim(typeof value === "string" ? value : "", trimStrings));
          i += 1 + resolved.consumed;
          continue;
        }
        emit("$");
        i += 1;
        continue;
      }
      // "$" before any other character is a literal dollar sign.
      emit("$");
      i += 1;
      continue;
    }

    if (c === "{") {
      if (template.slice(i, i + 9).toLowerCase() === "{{match}}") {
        emit(applyTrim(whole, trimStrings));
        i += 9;
        continue;
      }
      // Any other "{{...}}" (e.g. a macro token) stays literal here; "after" mode resolves it later.
      emit("{");
      i += 1;
      continue;
    }

    // Emit the literal run up to the next trigger in one go (keeps astral characters intact).
    let j = i + 1;
    while (j < n) {
      const cj = template[j]!;
      if (cj === "\\" || cj === "$" || cj === "{") break;
      j += 1;
    }
    emit(template.slice(i, j));
    i = j;
  }

  return out;
}
