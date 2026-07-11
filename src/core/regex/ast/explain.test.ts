/**
 * explainAst tests (REGEX-JEWEL-PLAN.md Phase R2X, QOL 20). Every case is grounded on a REAL AST
 * from parseRegex (never a hand-built node), so the reading is proven against the engine's own parse
 * of the pattern. Coverage: one case per node type in the union, plus the plan's gnarly composites
 * (the [status] rule, a lookbehind, a named-group backreference), the flag effects (i/g notes, m on
 * anchors, s on dot), and the honesty edges (ASCII wording, coalesced literal runs, empty pattern).
 *
 * Self-check caveat: this suite is authored alongside explain.ts, so a toContain assertion cannot by
 * itself prove readability - it proves the phrase is STABLE and STRUCTURALLY present. The parse is the
 * external oracle; the phrasings are held to the no-jargon house voice by review.
 */
import { describe, expect, test } from "bun:test";
import type { Alternation } from "./ast-types";
import { parseRegex } from "./index";
import { explainAst } from "./explain";

const astOf = (pattern: string, flags = "u"): Alternation => {
  const r = parseRegex(pattern, flags);
  if (!("ast" in r)) throw new Error(`expected /${pattern}/ to parse, got: ${r.error}`);
  return r.ast;
};

const explain = (pattern: string, flags = "u"): string => explainAst(astOf(pattern, flags), flags).text;

describe("one case per node type", () => {
  test("literal run coalesces into one quoted word", () => {
    expect(explain("cat")).toBe('The text "cat".');
  });

  test("single literal reads as a character", () => {
    expect(explain("a")).toBe('The character "a".');
  });

  test("dot", () => {
    expect(explain(".")).toBe("Any character except a line break.");
  });

  test("alternation", () => {
    expect(explain("cat|dog")).toBe('Either the text "cat" or the text "dog".');
  });

  test("alternation of three", () => {
    expect(explain("a|b|c")).toBe('Either the character "a", the character "b", or the character "c".');
  });

  test("anchors: line-start and line-end (no m flag = whole text)", () => {
    expect(explain("^a$")).toBe('The start of the text, then the character "a", then the end of the text.');
  });

  test("word-boundary anchor uses plain words", () => {
    const text = explain("\\bword\\b");
    expect(text).toContain("the edge of a word");
    expect(text).not.toContain("boundary");
  });

  test("non-word-boundary anchor", () => {
    expect(explain("\\Ba")).toContain("spot that is not the edge of a word");
  });

  test("class escapes read ASCII-honestly", () => {
    expect(explain("\\d")).toBe("Any digit.");
    expect(explain("\\w")).toBe("Any English letter, digit, or underscore.");
    expect(explain("\\s")).toBe("Any space, tab, or line break.");
    expect(explain("\\W")).toBe("Any character that is not an English letter, digit, or underscore.");
  });

  test("unicode property (name only and name=value, negated)", () => {
    expect(explain("\\p{Letter}")).toBe('Any character in the Unicode group "Letter".');
    expect(explain("\\P{Letter}")).toBe('Any character not in the Unicode group "Letter".');
    expect(explain("\\p{Script=Greek}")).toBe('Any character whose Unicode "Script" is "Greek".');
  });

  test("character class list", () => {
    expect(explain("[abc]")).toBe('Any of: "a", "b", or "c".');
  });

  test("character class range and negation phrasing", () => {
    expect(explain("[a-z]")).toBe('Any of: "a" through "z".');
    expect(explain("[^0-9]")).toBe('Any character except "0" through "9".');
    expect(explain("[a\\d]")).toBe('Any of: "a" or a digit.');
  });

  test("[\\s\\S] simplifies to any character", () => {
    expect(explain("[\\s\\S]")).toBe("Any character, including line breaks.");
    expect(explain("[\\d\\D]")).toBe("Any character, including line breaks.");
  });

  test("quantifiers cover every form", () => {
    expect(explain("a*")).toBe('The character "a" (zero or more times).');
    expect(explain("a+")).toBe('The character "a" (one or more times).');
    expect(explain("a?")).toBe('The character "a" (optional).');
    expect(explain("a{3}")).toBe('The character "a" (exactly 3 times).');
    expect(explain("a{2,}")).toBe('The character "a" (2 or more times).');
    expect(explain("a{2,4}")).toBe('The character "a" (between 2 and 4 times).');
  });

  test("lazy quantifier says as few as possible", () => {
    expect(explain("a+?")).toBe('The character "a" (one or more times, as few as possible).');
  });

  test("groups: capturing, named, non-capturing", () => {
    expect(explain("(ab)")).toBe('A remembered piece (group 1), containing: the text "ab".');
    expect(explain("(?<year>ab)")).toBe('A remembered piece named "year", containing: the text "ab".');
    expect(explain("(?:ab)")).toBe('A group of: the text "ab".');
  });

  test("modifier group turns settings on in plain words", () => {
    const text = explain("(?i:ab)");
    expect(text).toContain("capital and lowercase letters are treated the same");
    expect(text).toContain('containing: the text "ab"');
  });

  test("lookarounds: all four directions with correct polarity", () => {
    expect(explain("(?=a)")).toContain("must be followed by:");
    expect(explain("(?!a)")).toContain("must not be followed by:");
    expect(explain("(?<=a)")).toContain("must be preceded by:");
    expect(explain("(?<!a)")).toContain("must not be preceded by:");
  });

  test("backreferences: numeric and named", () => {
    expect(explain("(a)\\1")).toContain("the same text that remembered piece (group 1) matched");
    expect(explain("(?<w>a)\\k<w>")).toContain('the same text that the piece named "w" matched');
  });
});

describe("flag effects", () => {
  test("m flag flips anchors to line edges", () => {
    expect(explain("^a$", "mu")).toBe('The start of a line, then the character "a", then the end of a line.');
  });

  test("s flag flips dot to include line breaks", () => {
    expect(explain(".", "su")).toBe("Any character, including line breaks.");
  });

  test("i flag adds a case note, not an inline change", () => {
    const out = explainAst(astOf("cat"), "iu");
    expect(out.flagNotes).toContain("Matching ignores whether letters are capital or lowercase.");
  });

  test("g flag adds a find-all note", () => {
    const out = explainAst(astOf("cat"), "gu");
    expect(out.flagNotes).toContain("Finds every match in the text, not just the first.");
  });

  test("no notes when only structural flags are set", () => {
    expect(explainAst(astOf("cat"), "u").flagNotes).toEqual([]);
  });

  test("Risu-style <cbs> extension token does not falsely trigger dotall via its 's'", () => {
    // "gu<cbs>" contains an 's'; it must be stripped, so dot stays "except a line break".
    expect(explain(".", "gu<cbs>")).toBe("Any character except a line break.");
  });
});

describe("gnarly composites from the plan", () => {
  test("the [status] rule reads mechanically and honestly", () => {
    const text = explain("\\[status\\][\\s\\S]*?\\[/status\\]");
    expect(text).toContain('The text "[status]"');
    expect(text).toContain("any character, including line breaks (zero or more times, as few as possible)");
    expect(text).toContain('the text "[/status]"');
    // it must NOT invent the builder's "between X and Y" idiom - that is builder.ts's job.
    expect(text).not.toContain("between [status]");
  });

  test("a lookbehind composite", () => {
    expect(explain("(?<=@)\\w+")).toBe(
      'A spot that must be preceded by: the character "@", then any English letter, digit, or underscore (one or more times).',
    );
  });

  test("a named-group backreference composite", () => {
    expect(explain("(?<word>\\w+)\\s+\\k<word>")).toBe(
      'A remembered piece named "word", containing: any English letter, digit, or underscore (one or more times), ' +
        "then any space, tab, or line break (one or more times), " +
        'then the same text that the piece named "word" matched.',
    );
  });
});

describe("honesty edges", () => {
  test("empty pattern is stated, not left blank", () => {
    expect(explain("")).toBe("This pattern is empty: it matches an empty spot.");
  });

  test("empty alternative reads as nothing", () => {
    expect(explain("a|")).toBe('Either the character "a" or nothing.');
  });

  test("a control-character literal gets a friendly name, never a raw newline", () => {
    expect(explain("\\n")).toBe("A line break.");
    expect(explain("a\\tb")).toBe('The character "a", then a tab, then the character "b".');
  });
});
