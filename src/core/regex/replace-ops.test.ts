/**
 * replace-ops tests (REGEX-JEWEL-PLAN.md Phase R2X). Two verification strategies:
 *   - Native oracle: for every token the host String.replace supports ($$, $&, $`, $', $<name>,
 *     $N) the per-match reconstruction MUST equal `text.replace(nonGlobalRegex, template)`. The
 *     host engine is the truth (engine-truth rule); this is run under bun/JSC.
 *   - Pinned semantics: {{match}} sugar, PCRE/Perl case transforms, and trimStrings have no host
 *     oracle, so each is asserted against explicit expected output on execution-derived matches.
 */
import { describe, expect, test } from "bun:test";
import {
  applyTrim,
  escapeRegexChars,
  expandReplacement,
  substituteAfterMacros,
  substituteFindMacros,
  substituteMacros,
} from "./replace-ops";

/** Run a NON-GLOBAL regex once and rebuild the whole string the way our engine would per match. */
function reconstruct(text: string, re: RegExp, template: string): string {
  const m = text.match(re);
  if (!m) return text;
  const start = m.index ?? 0;
  const expanded = expandReplacement(template, m);
  return text.slice(0, start) + expanded + text.slice(start + m[0].length);
}

/** Assert our reconstruction equals the host engine's own replace for this template. */
function expectOracle(text: string, re: RegExp, template: string): void {
  expect(reconstruct(text, re, template)).toBe(text.replace(re, template));
}

/** Grab the first match of a non-global regex (throws in-test if the fixture is wrong). */
function firstMatch(text: string, re: RegExp): RegExpMatchArray {
  const m = text.match(re);
  if (!m) throw new Error(`test fixture: /${re.source}/ did not match ${JSON.stringify(text)}`);
  return m;
}

describe("expandReplacement - native-oracle parity (host engine is the truth)", () => {
  test("$$ emits a literal dollar", () => {
    expectOracle("a cat b", /cat/, "cost $$5");
  });

  test("$& is the whole match", () => {
    expectOracle("a cat b", /c.t/, "[$&]");
  });

  test("$` is the prefix, $' is the suffix", () => {
    expectOracle("hello world end", /world/, "<$`|$'>");
  });

  test("prefix/suffix at the string boundaries", () => {
    expectOracle("world end", /world/, "[$`][$']"); // empty prefix
    expectOracle("start world", /world/, "[$`][$']"); // empty suffix
    expectOracle("world", /world/, "[$`][$']"); // both empty (match is whole string)
  });

  test("numbered groups", () => {
    expectOracle("2024-01-31", /(\d+)-(\d+)-(\d+)/, "$3/$2/$1");
  });

  test("$0 and out-of-range $N stay literal, exactly like the host", () => {
    expectOracle("a cat b", /(c)(a)(t)/, "$0"); // $0 -> literal "$0"
    expectOracle("a cat b", /(c)(a)(t)/, "$9"); // only 3 groups -> literal "$9"
  });

  test("two-digit fallback: $12 with 3 groups is group1 + literal '2'", () => {
    expectOracle("cat", /(c)(a)(t)/, "$12");
  });

  test("two-digit resolves to group 12 when it exists", () => {
    const re = /(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)(l)/;
    expectOracle("abcdefghijkl", re, "[$12]");
  });

  test("named groups by name and reorder", () => {
    expectOracle("2024-01-31", /(?<y>\d+)-(?<m>\d+)-(?<d>\d+)/, "$<d>/$<m>/$<y>");
  });

  test("named-group reference that does not exist -> empty (regex HAS named groups)", () => {
    expectOracle("2024-01-31", /(?<y>\d+)-\d+-\d+/, "[$<missing>]");
  });

  test("$<name> stays literal when the regex has NO named groups", () => {
    expectOracle("a cat b", /cat/, "[$<x>]");
  });

  test("optional group that did not participate -> empty", () => {
    expectOracle("color", /colou?(r)/, "[$1]");
  });

  test("trailing bare $ is literal", () => {
    expectOracle("a cat b", /cat/, "price: $");
  });

  test("adjacent tokens and literal text mix", () => {
    expectOracle("John Smith", /(\w+) (\w+)/, "$2, $1 ($&)");
  });
});

describe("expandReplacement - {{match}} sugar (no host oracle)", () => {
  test("{{match}} equals $&", () => {
    const m = firstMatch("a cat b", /cat/);
    expect(expandReplacement("[{{match}}]", m)).toBe("[cat]");
  });

  test("{{match}} is case-insensitive", () => {
    const m = firstMatch("a cat b", /cat/);
    expect(expandReplacement("{{MATCH}}-{{Match}}", m)).toBe("cat-cat");
  });

  test("a non-match brace token stays literal (macro pass handles it later)", () => {
    const m = firstMatch("a cat b", /cat/);
    expect(expandReplacement("{{user}} says {{match}}", m)).toBe("{{user}} says cat");
  });
});

describe("expandReplacement - PCRE/Perl case transforms (pinned to perlop)", () => {
  test("\\U ... \\E uppercases a run", () => {
    const m = firstMatch("hello", /hello/);
    expect(expandReplacement("\\Uhi \\Ethere", m)).toBe("HI there");
  });

  test("\\L ... \\E lowercases a run", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\LHELLO\\E WORLD", m)).toBe("hello WORLD");
  });

  test("\\u uppercases exactly the next code point", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\uhello", m)).toBe("Hello");
  });

  test("\\l lowercases exactly the next code point", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\lHELLO", m)).toBe("hELLO");
  });

  test("one-shot OVERRIDES the run for one char then the run resumes (perlop mirror pair)", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\u\\LHELLO", m)).toBe("Hello");
    expect(expandReplacement("\\l\\UheLLo", m)).toBe("hELLO");
  });

  test("a run continues after a one-shot spends its single character", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\Uabc\\ldef", m)).toBe("ABCdEF");
  });

  test("transforms span group boundaries", () => {
    const m = firstMatch("foo bar", /(foo) (bar)/);
    expect(expandReplacement("\\U$1 $2\\E!", m)).toBe("FOO BAR!");
  });

  test("one-shot applies to the first char of a substituted group", () => {
    const m = firstMatch("foo", /(foo)/);
    expect(expandReplacement("\\u$1", m)).toBe("Foo");
  });

  test("one-shot survives an empty substitution and lands on the next real char", () => {
    // group 1 is optional and absent -> $1 emits nothing -> \u still upper-cases the next char.
    const m = firstMatch("bc", /(a)?bc/);
    expect(expandReplacement("\\u$1bc", m)).toBe("Bc");
  });

  test("\\\\ emits a literal backslash and lets the next char stay literal (escape hatch for \\U)", () => {
    const m = firstMatch("X", /X/);
    expect(expandReplacement("\\\\U", m)).toBe("\\U");
  });
});

describe("expandReplacement - trimStrings apply to substituted values, not context", () => {
  test("trim strips fragments from $&, named, and numbered values", () => {
    const m = firstMatch("[[cat]]", /\[\[(?<animal>\w+)\]\]/);
    expect(expandReplacement("$&|$<animal>|$1", m, { trimStrings: ["[", "]"] })).toBe("cat|cat|cat");
  });

  test("trim never touches prefix, suffix, or literal template text", () => {
    const m = firstMatch("[x]cat[y]", /cat/);
    // Prefix "[x]" and suffix "[y]" and the literal "[keep]" survive; only $& would be trimmed.
    expect(expandReplacement("[keep]$`$&$'", m, { trimStrings: ["[", "]"] })).toBe("[keep][x]cat[y]");
  });
});

describe("macro helpers - faithful extraction of apply.ts behavior", () => {
  test("substituteMacros replaces {{key}} case-insensitively", () => {
    expect(substituteMacros("hi {{User}}", { user: "Ada" }, false)).toBe("hi Ada");
  });

  test("substituteMacros in escaped mode escapes regex metacharacters in the value", () => {
    expect(substituteMacros("{{k}}", { k: "a.b*c" }, true)).toBe("a\\.b\\*c");
  });

  test("a $ inside a macro value is never treated as a replacement token", () => {
    expect(substituteMacros("{{k}}", { k: "$1 & $&" }, false)).toBe("$1 & $&");
  });

  test("undefined macros leave text untouched", () => {
    expect(substituteMacros("hi {{user}}", undefined, false)).toBe("hi {{user}}");
  });

  test("substituteFindMacros: raw substitutes, escaped escapes, none/after leave find alone", () => {
    const macros = { name: "a.b" };
    expect(substituteFindMacros("x{{name}}y", "raw", macros)).toBe("xa.by");
    expect(substituteFindMacros("x{{name}}y", "escaped", macros)).toBe("xa\\.by");
    expect(substituteFindMacros("x{{name}}y", "none", macros)).toBe("x{{name}}y");
    expect(substituteFindMacros("x{{name}}y", "after", macros)).toBe("x{{name}}y");
  });

  test("substituteAfterMacros only resolves in 'after' mode", () => {
    const macros = { who: "Ada" };
    expect(substituteAfterMacros("hi {{who}}", "after", macros)).toBe("hi Ada");
    expect(substituteAfterMacros("hi {{who}}", "none", macros)).toBe("hi {{who}}");
    expect(substituteAfterMacros("hi {{who}}", "raw", macros)).toBe("hi {{who}}");
  });
});

describe("escapeRegexChars + applyTrim primitives", () => {
  test("escapeRegexChars escapes every metacharacter", () => {
    expect(escapeRegexChars("a.b*c+d?(e)")).toBe("a\\.b\\*c\\+d\\?\\(e\\)");
    // Escaped output compiles and matches the literal string exactly.
    const literal = "a.b*c+d?(e)";
    expect(new RegExp(`^${escapeRegexChars(literal)}$`).test(literal)).toBe(true);
  });

  test("applyTrim removes every occurrence of every fragment", () => {
    expect(applyTrim("**a**b**", ["**"])).toBe("ab");
    expect(applyTrim("<x>cat</x>", ["<x>", "</x>"])).toBe("cat");
    expect(applyTrim("keep", [])).toBe("keep");
    expect(applyTrim("keep", [""])).toBe("keep"); // empty fragment is a no-op, never an infinite split
  });
});

/**
 * Macro expansion resolves in ONE pass, so the result depends only on the map's contents and never
 * on its insertion order. The previous per-key loop left text inserted by one key visible to every
 * later key, so the same logical map produced different output depending on how it was built.
 */
describe("macro substitution is order-independent", () => {
  test("a value that looks like another token is output, not re-expanded", () => {
    expect(substituteMacros("[{{a}}]", { a: "{{b}}", b: "BOOM" }, false)).toBe("[{{b}}]");
  });

  test("the reverse insertion order gives exactly the same answer", () => {
    const forward = substituteMacros("[{{a}}]", { a: "{{b}}", b: "BOOM" }, false);
    const reverse = substituteMacros("[{{a}}]", { b: "BOOM", a: "{{b}}" }, false);
    expect(forward).toBe(reverse);
  });

  test("a self-referential value does not loop or re-expand", () => {
    expect(substituteMacros("[{{a}}]", { a: "{{a}}" }, false)).toBe("[{{a}}]");
  });

  test("independent tokens all resolve in the single pass", () => {
    expect(substituteMacros("{{a}}-{{b}}-{{a}}", { a: "1", b: "2" }, false)).toBe("1-2-1");
  });

  test("an unknown token is left exactly as written", () => {
    expect(substituteMacros("{{known}} {{unknown}}", { known: "yes" }, false)).toBe("yes {{unknown}}");
  });

  test("a key whose value is empty resolves to empty, not to a literal token", () => {
    expect(substituteMacros("[{{k}}]", { k: "" }, false)).toBe("[]");
  });

  test("regex metacharacters in a KEY are matched literally, not as a pattern", () => {
    expect(substituteMacros("[{{a.b}}]", { "a.b": "hit" }, false)).toBe("[hit]");
    // the "." must not behave as a regex wildcard and match "axb"
    expect(substituteMacros("[{{axb}}]", { "a.b": "hit" }, false)).toBe("[{{axb}}]");
  });

  test("spacing inside the braces is significant, as before", () => {
    expect(substituteMacros("{{ user }}", { user: "Ada" }, false)).toBe("{{ user }}");
  });

  /**
   * Documented limitation rather than a regression worth code: a macro KEY containing braces is not
   * addressable, because the token grammar stops at the first brace so a stray "{{" cannot swallow
   * the rest of the template. No real macro map uses brace keys; pinned so the tradeoff is explicit.
   */
  test("a key containing braces is not addressable", () => {
    expect(substituteMacros("[{{a{b}}]", { "a{b": "hit" }, false)).toBe("[{{a{b}}]");
  });
});
