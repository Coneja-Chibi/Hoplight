/**
 * analyzeRedos tests (REGEX-JEWEL-PLAN.md Phase R2X). The judgment for this detector:
 * (a) the canonical bombs are flagged with the EXACT culprit span (asserted off the parsed node,
 *     and against literal offsets for the plan's `(a+)+$` case);
 * (b) linear equivalents that merely look nested pass clean - the precision bar, since a false
 *     positive here cries wolf on a safe pattern;
 * (c) each of the three structural culprits (nested quantifier, overlapping alternation, quantified
 *     backreference) is exercised, plus the severity roll-up and same-span dedupe.
 *
 * Patterns are parsed under the unicode-mode grammar (the parser's contract), so every fixture is
 * parsed with the `u` flag.
 */
import { describe, expect, test } from "bun:test";
import type { Alternation, Node, Quantifier } from "./ast-types";
import { parseRegex } from "./index";
import { analyzeRedos } from "./redos";

const astOf = (pattern: string): Alternation => {
  const r = parseRegex(pattern, "u");
  if (!("ast" in r)) throw new Error(`expected /${pattern}/ to parse, got: ${r.error}`);
  return r.ast;
};

const report = (pattern: string): ReturnType<typeof analyzeRedos> => analyzeRedos(astOf(pattern));

/** Locate the first unbounded quantifier node, so a span assertion reads the real AST offset. */
const firstUnboundedQuantifier = (ast: Alternation): Quantifier => {
  let found: Quantifier | null = null;
  const walk = (node: Node): void => {
    if (found) return;
    if (node.type === "quantifier" && node.max === null) {
      found = node;
      return;
    }
    switch (node.type) {
      case "alternation":
        node.alternatives.forEach(walk);
        return;
      case "sequence":
        node.elements.forEach(walk);
        return;
      case "quantifier":
      case "group":
      case "lookaround":
        walk(node.body);
        return;
      default:
        return;
    }
  };
  walk(ast);
  if (!found) throw new Error("no unbounded quantifier in AST");
  return found;
};

describe("nested unbounded quantifiers (exponential)", () => {
  const bombs = ["(a+)+", "(a*)*", "(a+)*", "(a*)+", "(.+)+", "(\\w+)+", "([ab]+)+", "(a+a)+", "((a+))+"];
  for (const pattern of bombs) {
    test(`flags /${pattern}/ as dangerous`, () => {
      const r = report(pattern);
      expect(r.severity).toBe("dangerous");
      expect(r.findings.some((f) => f.kind === "nested-quantifier")).toBe(true);
    });
  }

  test("the plan's canonical bomb (a+)+$ flags with the exact literal span", () => {
    const r = report("(a+)+$");
    expect(r.findings).toHaveLength(1);
    const finding = r.findings[0];
    expect(finding?.kind).toBe("nested-quantifier");
    expect(finding?.severity).toBe("dangerous");
    // (a+)+ occupies characters [0,5); the trailing $ is excluded.
    expect(finding?.culpritSpan).toEqual({ start: 0, end: 5 });
  });

  test("span tracks the real AST offset when the bomb is not at position 0", () => {
    const pattern = "foo(a+)+";
    const ast = astOf(pattern);
    const q = firstUnboundedQuantifier(ast);
    const r = analyzeRedos(ast);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.culpritSpan).toEqual({ start: q.start, end: q.end });
    expect(r.findings[0]?.culpritSpan).toEqual({ start: 3, end: 8 });
    expect(pattern.slice(3, 8)).toBe("(a+)+");
  });
});

describe("linear equivalents pass clean (precision bar)", () => {
  const safe = [
    "(a+b)+", // mandatory 'b' separates iterations
    "(a+b)*",
    "(ab+)+", // mandatory 'a' before each b-run
    "(ab)+",
    "a+b+",
    "a+",
    "(abc)*",
    "\\d+\\.\\d+",
    "[a-z]+",
    "(\\d+)-(\\d+)",
    "hello",
    "\\d{3}",
  ];
  for (const pattern of safe) {
    test(`/${pattern}/ is safe`, () => {
      const r = report(pattern);
      expect(r.severity).toBe("safe");
      expect(r.findings).toHaveLength(0);
    });
  }
});

describe("overlapping alternation under a quantifier", () => {
  test("(a|a)+ (equal alternatives) is dangerous", () => {
    const r = report("(a|a)+");
    expect(r.severity).toBe("dangerous");
    expect(r.findings[0]?.kind).toBe("overlapping-alternation");
  });

  test("(a|ab)+ (prefix ambiguity) is dangerous", () => {
    const r = report("(a|ab)+");
    expect(r.severity).toBe("dangerous");
    expect(r.findings[0]?.kind).toBe("overlapping-alternation");
  });

  test("(abc|ab)+ (prefix ambiguity, either order) is dangerous", () => {
    expect(report("(abc|ab)+").severity).toBe("dangerous");
  });

  test("(\\d|\\w)+ (complex first-set overlap) is only suspicious", () => {
    const r = report("(\\d|\\w)+");
    expect(r.severity).toBe("suspicious");
    expect(r.findings[0]?.kind).toBe("overlapping-alternation");
    expect(r.findings[0]?.severity).toBe("suspicious");
  });

  test("(a|b)+ (disjoint alternatives) is safe", () => {
    expect(report("(a|b)+").findings).toHaveLength(0);
  });

  test("(ab|ac)+ (same first char, diverging literals) is safe", () => {
    expect(report("(ab|ac)+").findings).toHaveLength(0);
  });

  test("(cat|dog|fish)+ (disjoint words) is safe", () => {
    expect(report("(cat|dog|fish)+").findings).toHaveLength(0);
  });
});

describe("quantified backreference", () => {
  test("(a)\\1+ is dangerous", () => {
    const r = report("(a)\\1+");
    expect(r.severity).toBe("dangerous");
    expect(r.findings.some((f) => f.kind === "quantified-backreference")).toBe(true);
  });

  test("(a)\\1 (unquantified backreference) is safe", () => {
    expect(report("(a)\\1").findings).toHaveLength(0);
  });
});

describe("severity roll-up and dedupe", () => {
  test("worst severity wins when suspicious and dangerous coexist", () => {
    const r = report("(\\d|\\w)+(a+)+");
    expect(r.severity).toBe("dangerous");
    expect(r.findings).toHaveLength(2);
  });

  test("two dangerous culprits both reported, sorted by span start", () => {
    const r = report("(a+)+|(x|xy)+");
    expect(r.severity).toBe("dangerous");
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0]?.culpritSpan.start).toBeLessThan(r.findings[1]?.culpritSpan.start ?? 0);
  });

  test("nested + alternation on the same span collapse to one dangerous finding", () => {
    const r = report("(a+|a+b)+");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.severity).toBe("dangerous");
    expect(r.findings[0]?.kind).toBe("nested-quantifier");
  });

  test("a plain pattern reports safe with no findings", () => {
    const r = report("\\d{3}-\\d{4}");
    expect(r.severity).toBe("safe");
    expect(r.findings).toHaveLength(0);
  });
});
