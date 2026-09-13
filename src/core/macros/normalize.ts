/**
 * Input normalization ahead of the macro parser, WITH an offset map back to the authored text.
 *
 * The reference pipeline (specs/engine/macro-engine.md stages 2-6) rewrites shorthand forms into
 * canonical `{{macro::arg}}` syntax before parsing, and that is exactly what would break the
 * editable preview: a segment's offsets must point into what the PERSON wrote, not into a string
 * five regexes made up. So every rewrite here is offset-mapped. The map answers one question -
 * "this range of normalized text came from which range of authored text" - and rewritten ranges
 * map to their whole authored tag, which is the honest answer (there is no finer-grained truth).
 *
 * Sentinels: `\{\{`/`\}\}` hide as \x01\x01/\x02\x02 so escaped braces survive parsing (restored
 * by the evaluator's post-pass). \x04 is the trim marker. Authored occurrences of these control
 * characters are left alone here; the corpus treats them as a collision hazard, and the restore
 * pass only unhides what this stage hid is NOT provable per character, which is the reference
 * engine's own accepted behavior (spec pipeline note).
 */

export interface NormalizedText {
  text: string;
  /** map[i] = authored offset for normalized offset i; length is text.length + 1 */
  map: Int32Array;
}

/** The authored range behind a normalized range. Clamped so end never precedes start. */
export function toSource(n: NormalizedText, start: number, end: number): { start: number; end: number } {
  const a = n.map[Math.max(0, Math.min(start, n.text.length))] ?? 0;
  const b = n.map[Math.max(0, Math.min(end, n.text.length))] ?? a;
  return { start: a, end: Math.max(a, b) };
}

const identity = (text: string): NormalizedText => {
  const map = new Int32Array(text.length + 1);
  for (let i = 0; i <= text.length; i++) map[i] = i;
  return { text, map };
};

/** One regex rewrite pass, composing the offset map. Replaced output maps to the matched range. */
function rewrite(
  n: NormalizedText,
  pattern: RegExp,
  replacer: (match: RegExpExecArray) => string,
): NormalizedText {
  const src = n.text;
  let out = "";
  const outMap: number[] = [];
  let last = 0;
  pattern.lastIndex = 0;
  for (let m = pattern.exec(src); m !== null; m = pattern.exec(src)) {
    for (let i = last; i < m.index; i++) {
      out += src.charAt(i);
      outMap.push(n.map[i] ?? 0);
    }
    const replacement = replacer(m);
    const srcStart = n.map[m.index] ?? 0;
    for (let i = 0; i < replacement.length; i++) {
      out += replacement.charAt(i);
      outMap.push(srcStart);
    }
    last = m.index + m[0].length;
    if (m[0].length === 0) pattern.lastIndex++; // safety; no pattern here matches empty
  }
  for (let i = last; i < src.length; i++) {
    out += src.charAt(i);
    outMap.push(n.map[i] ?? 0);
  }
  outMap.push(n.map[src.length] ?? 0);
  return { text: out, map: Int32Array.from(outMap) };
}

/** Space-form allowlist (spec stage 5): `{{roll 1d20}}` -> `{{roll::1d20}}` etc. */
const SPACE_ONE_ARG =
  /\{\{(roll|dice|incvar|decvar|getvar|var|hasvar|delvar|getglobalvar|gvar|incglobalvar|decglobalvar|hasglobalvar|delglobalvar)\s+([^:{}\s][^{}]*?)\}\}/gi;
const SPACE_TWO_ARG =
  /\{\{(setvar|addvar|setglobalvar|addglobalvar)\s+(\S+)\s+([^{}]*?)\}\}/gi;

/** Single-colon tolerance (spec stage 6); `(?!:)` keeps canonical `::` untouched. */
const SINGLE_COLON =
  /\{\{(random|pick|roll|dice|getvar|setvar|addvar|incvar|decvar|hasvar|delvar|getglobalvar|setglobalvar|addglobalvar|incglobalvar|decglobalvar|hasglobalvar|delglobalvar):(?!:)([^{}]*?)\}\}/gi;

const COMPARISON_OPS = ["<=", ">=", "===", "!==", "==", "!=", "<", ">"] as const;

/** Dot/dollar notation (spec stage 4). Standalone tags only; conditions are handled at eval. */
function rewriteDotDollar(n: NormalizedText): NormalizedText {
  let out = rewrite(n, /\{\{\$([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (m) => `{{getglobalvar::${m[1] ?? ""}}}`);
  out = rewrite(out, /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)\+\+\}\}/g, (m) => `{{incvar::${m[1] ?? ""}}}`);
  out = rewrite(out, /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)--\}\}/g, (m) => `{{decvar::${m[1] ?? ""}}}`);
  out = rewrite(
    out,
    /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)\s*\+=\s*([^{}]*?)\}\}/g,
    (m) => `{{addvar::${m[1] ?? ""}::${(m[2] ?? "").trim()}}}`,
  );
  out = rewrite(
    out,
    /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)\s*(<=|>=|===|!==|==|!=|<|>)\s*([^{}]*?)\}\}/g,
    (m) => `{{compare::{{getvar::${m[1] ?? ""}}}::${m[2] ?? "=="}::${(m[3] ?? "").trim()}}}`,
  );
  out = rewrite(
    out,
    /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)\s*=\s*([^{}]*?)\}\}/g,
    (m) => `{{setvar::${m[1] ?? ""}::${(m[2] ?? "").trim()}}}`,
  );
  out = rewrite(out, /\{\{\.([A-Za-z_][A-Za-z0-9_:]*)\}\}/g, (m) => `{{getvar::${m[1] ?? ""}}}`);
  return out;
}

/**
 * The full pre-parse normalization, offset-mapped. Stage order follows the spec: escaped-brace
 * hiding, angle tokens, dot/dollar, space form, single colon.
 */
export function normalizeMacroText(source: string): NormalizedText {
  let n = identity(source);
  n = rewrite(n, /\\\{\\\{/g, () => "\x01\x01");
  n = rewrite(n, /\\\}\\\}/g, () => "\x02\x02");
  n = rewrite(n, /<(user|char|bot)>/gi, (m) =>
    (m[1] ?? "").toLowerCase() === "user" ? "{{user}}" : "{{char}}",
  );
  n = rewriteDotDollar(n);
  n = rewrite(n, SPACE_ONE_ARG, (m) => `{{${(m[1] ?? "").toLowerCase()}::${(m[2] ?? "").trim()}}}`);
  n = rewrite(n, SPACE_TWO_ARG, (m) => `{{${(m[1] ?? "").toLowerCase()}::${m[2] ?? ""}::${m[3] ?? ""}}}`);
  n = rewrite(n, SINGLE_COLON, (m) => `{{${(m[1] ?? "").toLowerCase()}::${m[2] ?? ""}}}`);
  return n;
}

/** Restore the escaped-brace sentinels to literal braces (evaluator post-pass). */
export function restoreEscapedBraces(text: string): string {
  return text.replace(/\x01/g, "{").replace(/\x02/g, "}");
}

/** Ops the dot-notation compare rewrite can emit, shared with the compare handler. */
export const COMPARE_OPS: readonly string[] = COMPARISON_OPS;
