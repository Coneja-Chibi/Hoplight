/**
 * Dialect tolerance for imported foreign regex (REGEX-JEWEL-PLAN.md Phase R2X). Rival platforms
 * store PCRE/POSIX-flavored patterns that ECMAScript RegExp cannot compile as-is; `tolerate` runs a
 * single left-to-right pass that rewrites the safe, unambiguous foreign constructs into their JS
 * equivalents and returns a plain-language translation report for the import preview. Nothing is
 * silently mangled: a construct with no faithful JS form (an atomic group) is LEFT verbatim and
 * flagged for the human, never quietly reshaped into something that matches differently.
 *
 * `parseFlagTokens` is the structured twin of apply.ts's local `compileFlags`: it splits a stored
 * flags string (which may carry Risu extension tokens like the live "gu<cbs>") into the clean JS
 * flag chars and the opaque engine directives. It keeps compileFlags's discipline exactly (first-
 * seen order, deduped, invalid chars dropped) so apply.ts can adopt it later with no behavior
 * change; it additionally recognizes the ES2025 "v" flag, a harmless superset of that set.
 *
 * SAFETY: this module only rewrites and describes pattern STRINGS. It never compiles or runs them;
 * compilation and matching stay in core/regex/apply.ts under the sandbox doctrine.
 *
 * CONTRACT: `tolerate` returns `flags` that are ADDITIVE. They are the JS flags the rewrite now
 * requires (for example "u" once a POSIX class became a \p{...} escape); the caller merges them
 * with the rule's own stored flags. The returned `pattern` replaces the rule's `find`; the spans in
 * each note index the ORIGINAL input pattern, so the preview can point at what changed.
 */
import type { Span } from "./ast-types";

/** One translation the tolerance pass made (or declined to make), for the import preview report. */
export interface ToleranceNote {
  kind: "inline-flags" | "anchor" | "pcre-escape" | "posix-class" | "possessive" | "atomic-group";
  /** plain language, naive-reader copy (no jargon, no arrows) */
  message: string;
  /** half-open [start, end) into the ORIGINAL input pattern */
  span: Span;
}

export interface ToleranceResult {
  /** the rewritten pattern; replaces the rule's `find` */
  pattern: string;
  /** JS flags the rewrite now REQUIRES; the caller merges these with the rule's stored flags */
  flags: string;
  notes: ToleranceNote[];
}

/** Clean JS flag chars parseFlagTokens keeps (mirrors apply.ts compileFlags plus the "v" flag). */
const JS_FLAG_CHARS = new Set(["d", "g", "i", "m", "s", "u", "v", "y"]);

/** Inline PCRE flags that have a global JS equivalent, so hoisting them is faithful. */
const HOISTABLE_INLINE_FLAGS = new Set(["i", "m", "s", "u"]);

/** Canonical order for the additive `flags` result (the RegExp.flags getter order, minus none). */
const FLAG_ORDER = "dgimsuvy";

/**
 * POSIX bracket classes to their JS character-class body (chars that sit INSIDE a `[...]`). Entries
 * whose body uses a single \p{...} escape can be cleanly negated (\P{...}); the multi-atom entries
 * cannot, and the `[:^name:]` form for those is left verbatim with a note. Any body containing
 * "\p{" forces the "u" flag. graph/print/cntrl are approximations and say so in their note.
 */
const POSIX_BODY: Record<string, string> = {
  alpha: "\\p{L}",
  digit: "\\p{Nd}",
  alnum: "\\p{L}\\p{Nd}",
  upper: "\\p{Lu}",
  lower: "\\p{Ll}",
  space: "\\s",
  blank: " \\t",
  punct: "\\p{P}",
  word: "\\p{L}\\p{Nd}_",
  cntrl: "\\p{Cc}",
  xdigit: "0-9A-Fa-f",
  graph: "\\p{L}\\p{Nd}\\p{P}\\p{S}",
  print: "\\p{L}\\p{Nd}\\p{P}\\p{S} \\t",
};

/** POSIX names whose body is exactly one \p{...} escape (so \P{...} is a faithful negation). */
const SINGLE_PROPERTY_POSIX: Record<string, string> = {
  alpha: "L",
  digit: "Nd",
  upper: "Lu",
  lower: "Ll",
  punct: "P",
  cntrl: "Cc",
};

/** POSIX names whose translation is an approximation (surfaced honestly in the note). */
const APPROXIMATE_POSIX = new Set(["graph", "print", "cntrl"]);

/**
 * Split a stored flags string into clean JS flags and opaque engine directives. Mirrors apply.ts's
 * compileFlags exactly: JS flag chars are kept in first-seen order, deduped, and unknown chars are
 * dropped; the `<...>` tokens (Risu's CBS extension et al) are returned verbatim (trimmed) as
 * directives. Plain JS flag strings pass through untouched ("ig" stays "ig").
 */
/**
 * The exact JS flags apply.ts compiles a rule with. validate.ts gates with these SAME flags: a
 * pattern's validity depends on its flags (u/v strictness cuts both ways), so gate and engine
 * deriving flags separately is how "validates ok, throws on every run" happens.
 */
export function jsFlagsForRule(rule: { flags?: string; useFlags?: boolean }): string {
  return rule.useFlags ? parseFlagTokens(rule.flags || "g").jsFlags || "g" : "g";
}

export function parseFlagTokens(flags: string): { jsFlags: string; engineDirectives: string[] } {
  const engineDirectives: string[] = [];
  // Pull out every <...> token first; whatever is left is the raw JS-flag stream.
  const stripped = flags.replace(/<([^>]*)>/g, (_whole, inner: string) => {
    const token = inner.trim();
    if (token.length > 0) engineDirectives.push(token);
    return "";
  });
  const seen = new Set<string>();
  for (const c of stripped) {
    if (JS_FLAG_CHARS.has(c)) seen.add(c);
  }
  return { jsFlags: [...seen].join(""), engineDirectives };
}

/** Sort an additive-flag set into canonical order and join it. */
function joinFlags(set: Set<string>): string {
  return [...FLAG_ORDER].filter((f) => set.has(f)).join("");
}

/**
 * Match a bare inline-flag directive `(?flags)` or `(?flags-flags)` at `at` (which points at the
 * "("). Returns the added/removed flag letters and the exclusive end, or null when this is NOT a
 * bare directive (a scoped `(?i:...)`, a group `(?:`, a lookaround `(?=`, a named group `(?<name>`),
 * which are all left for the normal scan since JS handles them natively.
 */
function matchInlineFlags(src: string, at: number): { add: string; remove: string; end: number } | null {
  let j = at + 2;
  let add = "";
  let remove = "";
  let seenDash = false;
  while (j < src.length) {
    const c = src[j] as string;
    if (c === ")") {
      if (j === at + 2) return null; // "(?)" is not a flag directive
      return { add, remove, end: j + 1 };
    }
    if (c === "-" && !seenDash) {
      seenDash = true;
      j++;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      if (seenDash) remove += c;
      else add += c;
      j++;
      continue;
    }
    return null; // ":" or anything else means this is not a bare inline directive
  }
  return null; // unterminated
}

/** Match a `{n}` / `{n,}` / `{n,m}` brace quantifier at `at` (the "{"); return the exclusive end. */
function matchBraceQuantifier(src: string, at: number): number | null {
  let j = at + 1;
  let digits = 0;
  while (j < src.length && src[j]! >= "0" && src[j]! <= "9") {
    j++;
    digits++;
  }
  if (digits === 0) return null;
  if (src[j] === ",") {
    j++;
    while (j < src.length && src[j]! >= "0" && src[j]! <= "9") j++;
  }
  if (src[j] !== "}") return null;
  return j + 1;
}

/**
 * Read a POSIX bracket element `[:name:]` / `[:^name:]` at `at` (which points at the inner "["
 * inside an enclosing class). Returns the JS class-body replacement, whether it forces the "u" flag,
 * the exclusive end, and an optional note override for approximate/declined translations.
 */
type PosixRead =
  | { ok: true; body: string; needsU: boolean; end: number; message: string }
  | { ok: false };

function readPosixClass(src: string, at: number): PosixRead {
  let j = at + 2; // skip "[:"
  let negated = false;
  if (src[j] === "^") {
    negated = true;
    j++;
  }
  let name = "";
  while (j < src.length && /[a-z]/.test(src[j] as string)) name += src[j++];
  if (src[j] !== ":" || src[j + 1] !== "]") return { ok: false };
  const end = j + 2;

  const label = negated ? `[:^${name}:]` : `[:${name}:]`;

  if (negated) {
    const prop = SINGLE_PROPERTY_POSIX[name];
    if (prop === undefined) {
      // Multi-atom (alnum/word/...) or unknown: no faithful in-class negation. Leave verbatim.
      return {
        ok: true,
        body: src.slice(at, end),
        needsU: false,
        end,
        message: `Left the POSIX class ${label} unchanged: JavaScript has no faithful way to negate it inside a character class, so it is flagged for you to review.`,
      };
    }
    return {
      ok: true,
      body: `\\P{${prop}}`,
      needsU: true,
      end,
      message: `Converted the POSIX class ${label} to \\P{${prop}} and turned on the "u" (unicode) flag, which changes how the rest of the pattern is read.`,
    };
  }

  const body = POSIX_BODY[name];
  if (body === undefined) {
    return {
      ok: true,
      body: src.slice(at, end),
      needsU: false,
      end,
      message: `Left the unrecognized POSIX class ${label} unchanged for you to review.`,
    };
  }
  const needsU = body.includes("\\p{");
  const suffix = needsU
    ? ' and turned on the "u" (unicode) flag, which changes how the rest of the pattern is read'
    : "";
  const approx = APPROXIMATE_POSIX.has(name) ? " This translation is approximate" : "";
  return {
    ok: true,
    body,
    needsU,
    end,
    message: `Converted the POSIX class ${label} to ${body}${suffix}.${approx}`,
  };
}

/**
 * Rewrite a foreign regex pattern into a JavaScript-compatible one where a faithful translation
 * exists, returning the required additive flags and a plain-language report of every change. A
 * single left-to-right scan tracks whether it is inside a character class and honors backslash
 * escapes, so it never misfires on escaped metacharacters or class contents.
 */
export function tolerate(pattern: string): ToleranceResult {
  const notes: ToleranceNote[] = [];
  const addFlags = new Set<string>();
  const src = pattern;
  const n = src.length;
  let out = "";
  let i = 0;
  let inClass = false;

  while (i < n) {
    const ch = src[i] as string;

    // Escapes are consumed as a unit in every context, so a class-close or metachar never fires on
    // an escaped char. A handful of PCRE escapes translate; the rest pass through verbatim.
    if (ch === "\\") {
      const nx = src[i + 1];
      if (!inClass && nx === "A") {
        out += "^";
        notes.push({ kind: "anchor", message: "Converted \\A (start of the text) to ^.", span: { start: i, end: i + 2 } });
        i += 2;
        continue;
      }
      if (!inClass && nx === "z") {
        out += "$";
        notes.push({ kind: "anchor", message: "Converted \\z (very end of the text) to $.", span: { start: i, end: i + 2 } });
        i += 2;
        continue;
      }
      if (!inClass && nx === "Z") {
        out += "$";
        notes.push({
          kind: "anchor",
          message: "Converted \\Z to $. Note that \\Z also allows a match right before a final newline, which $ (without the \"m\" flag) does not.",
          span: { start: i, end: i + 2 },
        });
        i += 2;
        continue;
      }
      if (nx === "h") {
        out += inClass ? " \\t" : "[ \\t]";
        notes.push({ kind: "pcre-escape", message: "Converted \\h (a horizontal space) to a space or tab.", span: { start: i, end: i + 2 } });
        i += 2;
        continue;
      }
      if (nx === "R") {
        if (inClass) {
          out += "\\R";
          notes.push({
            kind: "pcre-escape",
            message: "Left \\R unchanged inside a character class: it means a line break and has no in-class equivalent. Flagged for you to review.",
            span: { start: i, end: i + 2 },
          });
        } else {
          out += "(?:\\r\\n|[\\r\\n])";
          notes.push({ kind: "pcre-escape", message: "Converted \\R (any line break) to (?:\\r\\n|[\\r\\n]).", span: { start: i, end: i + 2 } });
        }
        i += 2;
        continue;
      }
      // Any other escape: emit the backslash and its following char untouched.
      out += ch + (nx ?? "");
      i += nx === undefined ? 1 : 2;
      continue;
    }

    if (inClass) {
      if (ch === "[" && src[i + 1] === ":") {
        const posix = readPosixClass(src, i);
        if (posix.ok) {
          out += posix.body;
          if (posix.needsU) addFlags.add("u");
          notes.push({ kind: "posix-class", message: posix.message, span: { start: i, end: posix.end } });
          i = posix.end;
          continue;
        }
      }
      if (ch === "]") {
        inClass = false;
        out += ch;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    // Not in a character class from here down.
    if (ch === "[") {
      inClass = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === "(" && src[i + 1] === "?") {
      // Atomic group: no JS equivalent. Left verbatim so matching is never silently altered.
      if (src[i + 2] === ">") {
        out += "(?>";
        notes.push({
          kind: "atomic-group",
          message: "Left the atomic group (?>...) unchanged. JavaScript has no atomic groups, and rewriting one could silently change what the pattern matches, so it is flagged for you to review.",
          span: { start: i, end: i + 3 },
        });
        i += 3;
        continue;
      }
      // Bare inline flag directive: hoist to the whole pattern's flags.
      const inl = matchInlineFlags(src, i);
      if (inl) {
        const dropped: string[] = [];
        for (const f of inl.add) {
          if (HOISTABLE_INLINE_FLAGS.has(f)) addFlags.add(f);
          else dropped.push(f);
        }
        let message = "Moved the inline options to apply to the whole pattern.";
        if (i !== 0) {
          message += " They originally took effect only from where they appeared, so behavior may differ.";
        }
        if (dropped.length > 0) {
          message += ` The option${dropped.length > 1 ? "s" : ""} "${dropped.join("")}" could not be represented in JavaScript and ${dropped.length > 1 ? "were" : "was"} dropped.`;
        }
        if (inl.remove.length > 0) {
          message += ` Turning options off ("-${inl.remove}") cannot be represented in JavaScript and was dropped.`;
        }
        notes.push({ kind: "inline-flags", message, span: { start: i, end: inl.end } });
        i = inl.end;
        continue;
      }
      // Some other (?...) construct JS handles natively (?:, ?=, ?!, ?<name>, ?<=, ?<!, ?i:...).
      out += "(";
      i++;
      continue;
    }

    if (ch === "{") {
      const braceEnd = matchBraceQuantifier(src, i);
      if (braceEnd !== null) {
        out += src.slice(i, braceEnd);
        if (src[braceEnd] === "+") {
          notes.push({
            kind: "possessive",
            message: "Turned a possessive quantifier into a greedy one. Possessive quantifiers never give characters back, and JavaScript has no equivalent, so matching may differ on some input.",
            span: { start: i, end: braceEnd + 1 },
          });
          i = braceEnd + 1;
          continue;
        }
        if (src[braceEnd] === "?") {
          out += "?"; // lazy quantifier, valid JS, kept
          i = braceEnd + 1;
          continue;
        }
        i = braceEnd;
        continue;
      }
      out += ch; // a literal "{"
      i++;
      continue;
    }

    // Possessive form on the simple quantifiers: "a++", "a*+", "a?+".
    if ((ch === "+" || ch === "*" || ch === "?") && src[i + 1] === "+") {
      out += ch;
      notes.push({
        kind: "possessive",
        message: "Turned a possessive quantifier into a greedy one. Possessive quantifiers never give characters back, and JavaScript has no equivalent, so matching may differ on some input.",
        span: { start: i, end: i + 2 },
      });
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  return { pattern: out, flags: joinFlags(addFlags), notes };
}
