/**
 * Dialect tolerance tests (REGEX-JEWEL-PLAN.md Phase R2X). Every rewritten pattern is proven by the
 * ENGINE-TRUTH rule: compile the tolerated pattern+flags into a real RegExp and assert both a
 * positive match and a cheap negative, so a wrong translation cannot pass silently. The one
 * exception is the atomic group, which has no JS form on purpose: it is asserted structurally
 * (pattern unchanged, note emitted). parseFlagTokens covers the live "gu<cbs>" case plus plain JS
 * flag strings that must pass through untouched.
 */
import { describe, expect, test } from "bun:test";
import { parseFlagTokens, tolerate, type ToleranceNote } from "./dialect";

/** Compile a tolerance result and return the live RegExp (fresh each call, no shared lastIndex). */
function compile(pattern: string, flags: string): RegExp {
  return new RegExp(pattern, flags);
}

function kinds(notes: ToleranceNote[]): string[] {
  return notes.map((note) => note.kind);
}

describe("tolerate - inline flag directives", () => {
  test("leading (?i) hoists to the i flag and is removed from the pattern", () => {
    const result = tolerate("(?i)hello");
    expect(result.pattern).toBe("hello");
    expect(result.flags).toContain("i");
    expect(kinds(result.notes)).toContain("inline-flags");
    expect(compile(result.pattern, result.flags).test("HELLO")).toBe(true);
    expect(compile(result.pattern, result.flags).test("world")).toBe(false);
  });

  test("mid-pattern (?i) still hoists and notes the changed scope", () => {
    const result = tolerate("foo(?i)bar");
    expect(result.pattern).toBe("foobar");
    expect(result.flags).toContain("i");
    const note = result.notes.find((n) => n.kind === "inline-flags");
    expect(note?.message).toContain("differ");
    expect(compile(result.pattern, result.flags).test("FOOBAR")).toBe(true);
  });

  test("multiple hoistable flags (?ims) all land", () => {
    const result = tolerate("(?ims)a");
    expect(result.pattern).toBe("a");
    expect(result.flags).toContain("i");
    expect(result.flags).toContain("m");
    expect(result.flags).toContain("s");
  });

  test("un-representable inline flag (x) is dropped with a note, not compiled", () => {
    const result = tolerate("(?x)a b");
    expect(result.pattern).toBe("a b");
    expect(result.flags).not.toContain("x");
    const note = result.notes.find((n) => n.kind === "inline-flags");
    expect(note?.message).toContain("dropped");
  });

  test("a flag-off directive (?i-m) hoists i and notes the dropped removal", () => {
    const result = tolerate("(?i-m)a");
    expect(result.flags).toContain("i");
    expect(result.flags).not.toContain("m");
    expect(result.notes[0]?.message).toContain("off");
  });

  test("scoped modifier group (?i:...) is left for JS to handle natively", () => {
    const result = tolerate("(?i:cat)s");
    expect(result.pattern).toBe("(?i:cat)s");
    expect(result.notes).toHaveLength(0);
  });

  test("non-capturing and lookahead groups are untouched", () => {
    expect(tolerate("(?:ab)+").pattern).toBe("(?:ab)+");
    expect(tolerate("foo(?=bar)").pattern).toBe("foo(?=bar)");
    expect(tolerate("(?<name>x)\\k<name>").pattern).toBe("(?<name>x)\\k<name>");
  });
});

describe("tolerate - PCRE anchors", () => {
  test("\\A and \\z become ^ and $", () => {
    const result = tolerate("\\Afoo\\z");
    expect(result.pattern).toBe("^foo$");
    expect(kinds(result.notes)).toEqual(["anchor", "anchor"]);
    expect(compile(result.pattern, result.flags).test("foo")).toBe(true);
    expect(compile(result.pattern, result.flags).test("xfoo")).toBe(false);
  });

  test("\\Z becomes $ and warns about the trailing-newline difference", () => {
    const result = tolerate("end\\Z");
    expect(result.pattern).toBe("end$");
    const note = result.notes.find((n) => n.kind === "anchor");
    expect(note?.message).toContain("newline");
    expect(compile(result.pattern, result.flags).test("the end")).toBe(true);
    expect(compile(result.pattern, result.flags).test("ending")).toBe(false);
  });
});

describe("tolerate - PCRE escapes", () => {
  test("\\h becomes [ \\t] outside a class", () => {
    const result = tolerate("a\\hb");
    expect(result.pattern).toBe("a[ \\t]b");
    expect(kinds(result.notes)).toContain("pcre-escape");
    expect(compile(result.pattern, result.flags).test("a b")).toBe(true);
    expect(compile(result.pattern, result.flags).test("a\tb")).toBe(true);
    expect(compile(result.pattern, result.flags).test("axb")).toBe(false);
  });

  test("\\h inside a class becomes plain space+tab members", () => {
    const result = tolerate("[\\hx]");
    expect(result.pattern).toBe("[ \\tx]");
    expect(compile(result.pattern, result.flags).test(" ")).toBe(true);
    expect(compile(result.pattern, result.flags).test("y")).toBe(false);
  });

  test("\\R becomes the line-break alternation", () => {
    const result = tolerate("a\\Rb");
    expect(result.pattern).toBe("a(?:\\r\\n|[\\r\\n])b");
    expect(compile(result.pattern, result.flags).test("a\nb")).toBe(true);
    expect(compile(result.pattern, result.flags).test("a\r\nb")).toBe(true);
    expect(compile(result.pattern, result.flags).test("aXb")).toBe(false);
  });

  test("an ordinary escape like \\d passes through untouched", () => {
    const result = tolerate("\\d+");
    expect(result.pattern).toBe("\\d+");
    expect(result.notes).toHaveLength(0);
  });
});

describe("tolerate - POSIX classes", () => {
  test("[[:alpha:]] becomes a \\p{L} class and forces the u flag", () => {
    const result = tolerate("[[:alpha:]]+");
    expect(result.pattern).toBe("[\\p{L}]+");
    expect(result.flags).toContain("u");
    expect(kinds(result.notes)).toContain("posix-class");
    expect(compile(result.pattern, result.flags).test("abc")).toBe(true);
    expect(compile(result.pattern, result.flags).test("é")).toBe(true); // e-acute
    expect(compile(result.pattern, result.flags).test("5")).toBe(false);
  });

  test("[[:digit:]] maps to \\p{Nd}", () => {
    const result = tolerate("[[:digit:]]");
    expect(result.pattern).toBe("[\\p{Nd}]");
    expect(result.flags).toContain("u");
    expect(compile(result.pattern, result.flags).test("7")).toBe(true);
    expect(compile(result.pattern, result.flags).test("a")).toBe(false);
  });

  test("multi-atom [[:alnum:]] expands to letters and numbers", () => {
    const result = tolerate("[[:alnum:]]");
    expect(result.pattern).toBe("[\\p{L}\\p{Nd}]");
    expect(compile(result.pattern, result.flags).test("a")).toBe(true);
    expect(compile(result.pattern, result.flags).test("9")).toBe(true);
    expect(compile(result.pattern, result.flags).test("!")).toBe(false);
  });

  test("negated single-property [[:^digit:]] becomes \\P{Nd}", () => {
    const result = tolerate("[[:^digit:]]");
    expect(result.pattern).toBe("[\\P{Nd}]");
    expect(result.flags).toContain("u");
    expect(compile(result.pattern, result.flags).test("a")).toBe(true);
    expect(compile(result.pattern, result.flags).test("5")).toBe(false);
  });

  test("negated multi-atom [[:^alnum:]] is left verbatim with a review note", () => {
    const result = tolerate("[[:^alnum:]]");
    expect(result.pattern).toBe("[[:^alnum:]]");
    const note = result.notes.find((n) => n.kind === "posix-class");
    expect(note?.message).toContain("review");
  });

  test("[[:space:]] uses \\s and does not force the u flag", () => {
    const result = tolerate("[[:space:]]");
    expect(result.pattern).toBe("[\\s]");
    expect(result.flags).toBe("");
    expect(compile(result.pattern, result.flags).test(" ")).toBe(true);
    expect(compile(result.pattern, result.flags).test("x")).toBe(false);
  });

  test("approximate [[:print:]] is noted as approximate", () => {
    const result = tolerate("[[:print:]]");
    const note = result.notes.find((n) => n.kind === "posix-class");
    expect(note?.message).toContain("approximate");
    // still compiles to a real class
    expect(() => compile(result.pattern, result.flags)).not.toThrow();
  });
});

describe("tolerate - possessive quantifiers", () => {
  test("a++ becomes a+ with a warning", () => {
    const result = tolerate("a++");
    expect(result.pattern).toBe("a+");
    expect(kinds(result.notes)).toEqual(["possessive"]);
    expect(compile(result.pattern, result.flags).test("aaa")).toBe(true);
    expect(compile(result.pattern, result.flags).test("b")).toBe(false);
  });

  test("a*+ and a?+ drop the possessive marker", () => {
    expect(tolerate("a*+").pattern).toBe("a*");
    expect(tolerate("a?+").pattern).toBe("a?");
  });

  test("brace possessive a{2,3}+ becomes a{2,3}", () => {
    const result = tolerate("a{2,3}+");
    expect(result.pattern).toBe("a{2,3}");
    expect(kinds(result.notes)).toEqual(["possessive"]);
    expect(compile(result.pattern, result.flags).test("aa")).toBe(true);
    expect(compile(result.pattern, result.flags).test("a")).toBe(false);
  });

  test("a lazy quantifier a+? is kept, not treated as possessive", () => {
    const result = tolerate("a+?");
    expect(result.pattern).toBe("a+?");
    expect(result.notes).toHaveLength(0);
  });

  test("a lazy brace quantifier a{2,3}? is kept", () => {
    const result = tolerate("a{2,3}?");
    expect(result.pattern).toBe("a{2,3}?");
    expect(result.notes).toHaveLength(0);
  });

  test("an escaped plus after a quantifier is not misread as possessive", () => {
    const result = tolerate("a\\+");
    expect(result.pattern).toBe("a\\+");
    expect(result.notes).toHaveLength(0);
  });
});

describe("tolerate - atomic groups", () => {
  test("(?>...) is left verbatim and flagged, never rewritten", () => {
    const result = tolerate("(?>abc)d");
    expect(result.pattern).toBe("(?>abc)d");
    expect(kinds(result.notes)).toEqual(["atomic-group"]);
    expect(result.notes[0]?.message).toContain("review");
    // Its inner content is still scanned: the "d" after it is preserved as-is.
    expect(result.notes[0]?.span).toEqual({ start: 0, end: 3 });
  });

  test("constructs inside an atomic group are still tolerated", () => {
    const result = tolerate("(?>\\Afoo)");
    expect(result.pattern).toBe("(?>^foo)");
    expect(kinds(result.notes)).toEqual(["atomic-group", "anchor"]);
  });
});

describe("tolerate - clean patterns and composites", () => {
  test("a plain JS pattern passes through unchanged with no notes", () => {
    const result = tolerate("(?:abc)+\\d+");
    expect(result.pattern).toBe("(?:abc)+\\d+");
    expect(result.flags).toBe("");
    expect(result.notes).toEqual([]);
  });

  test("a class with a literal ] and metachars is untouched", () => {
    const result = tolerate("[\\]a+*]");
    expect(result.pattern).toBe("[\\]a+*]");
    expect(result.notes).toHaveLength(0);
  });

  test("a mixed foreign pattern rewrites every construct and merges flags", () => {
    const result = tolerate("(?i)\\A[[:alpha:]]++\\z");
    expect(result.pattern).toBe("^[\\p{L}]+$");
    expect(result.flags).toContain("i");
    expect(result.flags).toContain("u");
    expect(kinds(result.notes)).toEqual(["inline-flags", "anchor", "posix-class", "possessive", "anchor"]);
    expect(compile(result.pattern, result.flags).test("HELLO")).toBe(true);
    expect(compile(result.pattern, result.flags).test("hi there")).toBe(false);
  });

  test("flags come back in canonical order", () => {
    // (?s) adds s, POSIX forces u: canonical order is s before u.
    const result = tolerate("(?s)[[:alpha:]]");
    expect(result.flags).toBe("su");
  });
});

describe("parseFlagTokens", () => {
  test("the live Risu case gu<cbs> splits into flags and one directive", () => {
    expect(parseFlagTokens("gu<cbs>")).toEqual({ jsFlags: "gu", engineDirectives: ["cbs"] });
  });

  test("a plain JS flag string passes through untouched, first-seen order", () => {
    expect(parseFlagTokens("ig")).toEqual({ jsFlags: "ig", engineDirectives: [] });
    expect(parseFlagTokens("gim")).toEqual({ jsFlags: "gim", engineDirectives: [] });
  });

  test("an empty string yields empty results", () => {
    expect(parseFlagTokens("")).toEqual({ jsFlags: "", engineDirectives: [] });
  });

  test("a token-only string yields no JS flags", () => {
    expect(parseFlagTokens("<cbs>")).toEqual({ jsFlags: "", engineDirectives: ["cbs"] });
  });

  test("multiple directives are collected in order", () => {
    expect(parseFlagTokens("g<cbs><legacy>i")).toEqual({
      jsFlags: "gi",
      engineDirectives: ["cbs", "legacy"],
    });
  });

  test("duplicate flag chars are deduped, invalid chars dropped", () => {
    expect(parseFlagTokens("ggi")).toEqual({ jsFlags: "gi", engineDirectives: [] });
    expect(parseFlagTokens("gz")).toEqual({ jsFlags: "g", engineDirectives: [] });
  });

  test("the v flag is recognized as valid JS", () => {
    expect(parseFlagTokens("v")).toEqual({ jsFlags: "v", engineDirectives: [] });
  });

  test("empty and whitespace-only tokens are ignored, contents trimmed", () => {
    expect(parseFlagTokens("g<>u")).toEqual({ jsFlags: "gu", engineDirectives: [] });
    expect(parseFlagTokens("g< cbs >")).toEqual({ jsFlags: "g", engineDirectives: ["cbs"] });
  });
});
