/**
 * Leaf escape lexers for the regex parser (REGEX-JEWEL-PLAN.md Phase R2X keystone). Each reads ONE
 * self-contained escape atom - a control/hex/unicode code point, or a `\p{...}` property - straight
 * from the source, with no parser state. Split from parser.ts to keep both files to one concept
 * under the 500-line cap; kept pure and no-throw (a Read result, not a shared exception) so there is
 * no cyclic dependency on the parser's error type.
 *
 * Every function is given the offset of the opening backslash; on success it returns the parsed
 * value and the exclusive `end` offset, on failure a message + the offset the caller should blame.
 */
type Fail = { ok: false; error: string; at: number };

/** A `\c`/`\x`/`\u` escape resolved to a single code point. */
export type CodePointRead = { ok: true; codePoint: number; end: number } | Fail;

/** A `\p{...}`/`\P{...}` property escape (name plus an optional `=value`). */
export type PropertyRead = { ok: true; name: string; value: string | undefined; end: number } | Fail;

const HEX = /[0-9a-fA-F]/;

/**
 * Read a `\c<letter>`, `\xHH`, or `\uHHHH` / `\u{...}` escape into its code point. `at` is the
 * backslash offset; `at + 1` is the type char (`c`, `x`, or `u`).
 */
export function readEscapeCodePoint(src: string, at: number): CodePointRead {
  const kind = src[at + 1];
  if (kind === "c") {
    const letter = src[at + 2];
    if (letter === undefined || !/[a-zA-Z]/.test(letter)) return { ok: false, error: "invalid control escape \\c", at };
    return { ok: true, codePoint: letter.charCodeAt(0) & 0x1f, end: at + 3 };
  }
  if (kind === "x") {
    const h1 = src[at + 2];
    const h2 = src[at + 3];
    if (h1 === undefined || h2 === undefined || !HEX.test(h1) || !HEX.test(h2)) {
      return { ok: false, error: "\\x needs two hex digits", at };
    }
    return { ok: true, codePoint: parseInt(h1 + h2, 16), end: at + 4 };
  }
  // kind === "u"
  if (src[at + 2] === "{") {
    let i = at + 3;
    let hex = "";
    while (i < src.length && HEX.test(src[i] as string)) hex += src[i++];
    if (hex.length === 0 || src[i] !== "}") return { ok: false, error: "malformed \\u{...} escape", at };
    const codePoint = parseInt(hex, 16);
    if (codePoint > 0x10ffff) return { ok: false, error: "code point out of range in \\u{...}", at };
    return { ok: true, codePoint, end: i + 1 };
  }
  let hex = "";
  for (let i = at + 2; i < at + 6; i++) {
    const h = src[i];
    if (h === undefined || !HEX.test(h)) return { ok: false, error: "\\u needs four hex digits", at };
    hex += h;
  }
  return { ok: true, codePoint: parseInt(hex, 16), end: at + 6 };
}

/**
 * Read a `\p{...}` / `\P{...}` unicode property escape. `at` is the backslash offset; `at + 1` is
 * `p` or `P` (the caller records negation). Unicode mode requires the braces.
 */
export function readUnicodeProperty(src: string, at: number): PropertyRead {
  if (src[at + 2] !== "{") return { ok: false, error: "\\p must be followed by {...} in unicode mode", at };
  let i = at + 3;
  let inner = "";
  while (i < src.length && src[i] !== "}") inner += src[i++];
  if (src[i] !== "}") return { ok: false, error: "unterminated \\p{...}", at };
  if (inner.length === 0) return { ok: false, error: "empty \\p{...}", at };
  const eq = inner.indexOf("=");
  const name = eq === -1 ? inner : inner.slice(0, eq);
  const value = eq === -1 ? undefined : inner.slice(eq + 1);
  return { ok: true, name, value, end: i + 1 };
}
