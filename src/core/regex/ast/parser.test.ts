/**
 * parseRegex / printRegex tests (REGEX-JEWEL-PLAN.md Phase R2X). The judgment for this keystone:
 * (a) acceptance-fuzz parity - the host RegExp is the oracle; parseRegex errors iff `new RegExp(p,
 *     "u")` throws, proven in BOTH directions with non-trivial counts on each side so a too-lenient
 *     or too-strict parser (or a vacuous corpus) fails.
 * (b) printRegex round-trips - it reconstructs from nodes (fixpoint-stable), and the reprint
 *     compiles to a matcher behaviourally identical to the original on a probe corpus.
 * (c) one explicit case per node type.
 * (d) named groups, lookbehind, unicode property escapes, numeric + named backrefs, every quantifier
 *     form incl. lazy, and character classes with ranges/escapes/negation.
 *
 * The parser targets the unicode-mode grammar, so every oracle here compiles with the `u` flag.
 * Seeded rng is injected (no Math.random), so a failure is reproducible from its seed.
 */
import { describe, expect, test } from "bun:test";
import type { Alternation, CharClass, Group, Node, Quantifier } from "./ast-types";
import { parseRegex, printRegex, V_MODE_ENABLED } from "./index";

// --- helpers ---------------------------------------------------------------

const throwsU = (p: string): boolean => {
  try {
    new RegExp(p, "u");
    return false;
  } catch {
    return true;
  }
};

const astOf = (p: string): Alternation => {
  const r = parseRegex(p, "u");
  if (!("ast" in r)) throw new Error(`expected parse ok for /${p}/ but got: ${r.error}`);
  return r.ast;
};

const errOf = (p: string): { error: string; at: number } => {
  const r = parseRegex(p, "u");
  if ("ast" in r) throw new Error(`expected parse error for /${p}/ but it parsed`);
  return r;
};

/** The first element of the first alternative - the single node in a one-atom pattern. */
const firstNode = (p: string): Node => {
  const seq = astOf(p).alternatives[0];
  if (!seq || !seq.elements[0]) throw new Error(`no first node in /${p}/`);
  return seq.elements[0];
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] as T;
const intBetween = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

// --- (b) equivalence + fixpoint -------------------------------------------

const PROBES = ["", "a", "abc", "A1b2", "cat dog", "😀x", "  ", "aaaa", "2024-01-02", "hi world!", "()[]{}", "café", "aaab"]; // emoji-ok: Unicode parser fixture data

const matchInfo = (re: RegExp, s: string): (string | undefined)[] | null => {
  const m = s.match(re);
  return m ? [String(m.index), ...m] : null;
};

/**
 * A quantifier applied to a group is the only way a pattern in this corpus can backtrack
 * catastrophically (`(a+)+`, `(.*)*`). Compiling and parsing such a pattern is instant; only
 * EXECUTING it against a repetitive probe can hang, so behavioural equivalence skips these and
 * relies on reprint-stability for them. Every other shape (quantified atoms, alternations, once-run
 * groups) is linear/polynomial on the short probes and is executed.
 */
function containsQuantifiedGroup(node: Node): boolean {
  switch (node.type) {
    case "quantifier":
      return node.body.type === "group" || containsQuantifiedGroup(node.body);
    case "alternation":
      return node.alternatives.some(containsQuantifiedGroup);
    case "sequence":
      return node.elements.some(containsQuantifiedGroup);
    case "group":
    case "lookaround":
      return containsQuantifiedGroup(node.body);
    default:
      return false;
  }
}

/** printRegex reconstructs from nodes: the reprint compiles and is a stable fixpoint (no execution). */
function assertReprintStable(p: string): Alternation {
  const ast = astOf(p);
  const printed = printRegex(ast);
  new RegExp(printed, "u"); // throws (fails the test) if the printer emitted garbage
  expect(printRegex(astOf(printed))).toBe(printed); // fixpoint: print . parse . print === print
  return ast;
}

/** The reprint matches the original on every probe (executes the compiled regex - callers gate bombs). */
function assertBehaviorEquiv(p: string): void {
  const orig = new RegExp(p, "u");
  const re = new RegExp(printRegex(astOf(p)), "u");
  for (const probe of PROBES) expect(matchInfo(re, probe)).toEqual(matchInfo(orig, probe));
}

/** Full round-trip for a curated, non-catastrophic pattern: reprint-stable AND behaviourally equal. */
function assertRoundTrips(p: string): void {
  assertReprintStable(p);
  assertBehaviorEquiv(p);
}

// --- pattern generators ----------------------------------------------------

const ANCHORS = ["^", "$", "\\b", "\\B"];
const LITERALS = ["a", "b", "z", "G", "0", "9", " ", "é", "😀"]; // emoji-ok: Unicode parser fixture data
const ESCAPED = ["\\.", "\\*", "\\+", "\\?", "\\(", "\\)", "\\[", "\\]", "\\{", "\\}", "\\|", "\\^", "\\$", "\\\\", "\\/", "\\n", "\\t", "\\r", "\\f", "\\v", "\\cA", "\\x41", "\\u0041", "\\u{1F600}"];
const CLASS_ESCAPES = ["\\d", "\\D", "\\w", "\\W", "\\s", "\\S"];
const PROPS = ["\\p{L}", "\\p{Letter}", "\\p{Nd}", "\\P{L}", "\\p{Script=Greek}", "\\p{White_Space}"];
const CLASS_ITEMS = ["a", "b", "z", "0", "9", "_", " ", "\\d", "\\w", "\\.", "\\-", "a-z", "0-9", "A-Z", "\\p{L}"];
const QUANTS = ["*", "+", "?", "{2}", "{0,3}", "{2,}", "{1,4}"];
const MODS = ["i", "m", "s", "i-m", "s-i", "im"];

interface GenCtx {
  n: number;
}

const genClass = (rng: () => number): string => {
  const neg = rng() < 0.3 ? "^" : "";
  const count = intBetween(rng, 1, 4);
  let body = "";
  for (let i = 0; i < count; i++) body += pick(rng, CLASS_ITEMS);
  return `[${neg}${body}]`;
};

function genQuantifiable(rng: () => number, ctx: GenCtx, depth: number): string {
  const roll = rng();
  if (depth <= 0 || roll < 0.4) {
    return pick(rng, [...LITERALS, ...ESCAPED, ".", ...CLASS_ESCAPES, ...PROPS]);
  }
  if (roll < 0.55) return genClass(rng);
  const inner = genAlt(rng, ctx, depth - 1);
  const kind = rng();
  if (kind < 0.4) return `(${inner})`;
  if (kind < 0.6) return `(?:${inner})`;
  if (kind < 0.8) return `(?<g${ctx.n++}>${inner})`;
  return `(?${pick(rng, MODS)}:${inner})`;
}

function genTerm(rng: () => number, ctx: GenCtx, depth: number): string {
  const roll = rng();
  if (roll < 0.15) return pick(rng, ANCHORS); // not quantifiable
  if (roll < 0.25 && depth > 0) return `(?${pick(rng, ["=", "!", "<=", "<!"])}${genAlt(rng, ctx, depth - 1)})`;
  let atom = genQuantifiable(rng, ctx, depth);
  if (rng() < 0.5) atom += pick(rng, QUANTS) + (rng() < 0.35 ? "?" : "");
  return atom;
}

function genSeq(rng: () => number, ctx: GenCtx, depth: number): string {
  const count = intBetween(rng, 0, 4);
  let out = "";
  for (let i = 0; i < count; i++) out += genTerm(rng, ctx, depth);
  return out;
}

function genAlt(rng: () => number, ctx: GenCtx, depth: number): string {
  const count = intBetween(rng, 1, 3);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) parts.push(genSeq(rng, ctx, depth));
  return parts.join("|");
}

const NOISE_ALPHABET = "abc()[]{}|\\^$.*+?<>=!:-,0123456789dwspPknu ".split("");
function genNoise(rng: () => number): string {
  const len = intBetween(rng, 1, 8);
  let out = "";
  for (let i = 0; i < len; i++) out += pick(rng, NOISE_ALPHABET);
  return out;
}

// --- (a) acceptance-fuzz parity -------------------------------------------

describe("acceptance-fuzz parity: parseRegex errors iff new RegExp(p, 'u') throws", () => {
  test("random-noise corpus explores the validity boundary in both directions", () => {
    const rng = mulberry32(0x1234abcd);
    let bothThrow = 0;
    let bothAccept = 0;
    for (let i = 0; i < 2500; i++) {
      const p = genNoise(rng);
      const hostThrows = throwsU(p);
      const weError = !("ast" in parseRegex(p, "u"));
      expect({ p, weError }).toEqual({ p, weError: hostThrows }); // biconditional, both directions
      if (hostThrows) bothThrow++;
      else bothAccept++;
    }
    expect(bothThrow).toBeGreaterThan(200); // the "should error" bucket is non-trivial
    expect(bothAccept).toBeGreaterThan(200); // the "should accept" bucket is non-trivial
  });

  test("structured valid-grammar corpus parses, round-trips, and matches the host", () => {
    const rng = mulberry32(0x0f0f55aa);
    let accepted = 0;
    for (let i = 0; i < 300; i++) {
      const p = genAlt(rng, { n: 0 }, 3);
      const hostThrows = throwsU(p);
      expect(!("ast" in parseRegex(p, "u"))).toBe(hostThrows); // biconditional
      if (!hostThrows) {
        accepted++;
        const ast = assertReprintStable(p);
        if (!containsQuantifiedGroup(ast)) assertBehaviorEquiv(p); // gate catastrophic-backtracking bombs
      }
    }
    expect(accepted).toBeGreaterThan(250); // the generator overwhelmingly produces real patterns
  });
});

// --- (b) printRegex on hand-picked shapes ---------------------------------

describe("printRegex reconstructs equivalent, fixpoint-stable patterns", () => {
  const shapes = [
    "abc",
    "a|b|c",
    "(?<year>\\d{4})-(?<mo>\\d{2})",
    "(?:ab)+?c*",
    "[A-Za-z_][A-Za-z0-9_]*",
    "(foo)\\1",
    "(?<=\\$)\\d+(?:\\.\\d{2})?",
    "\\p{L}+\\s\\P{Nd}",
    "(?i:HeLLo)\\bworld\\b",
    "a{2,4}?|b{3}|c{5,}",
    "[^\\n\\t\\\\]",
    "gr(a|e)y",
  ];
  for (const p of shapes) {
    test(`/${p}/`, () => assertRoundTrips(p));
  }

  test("printer rebuilds structure, not the source string (canonicalizes {2,2} -> {2})", () => {
    expect(printRegex(astOf("a{2,2}"))).toBe("a{2}");
    expect(printRegex(astOf("a{0,1}"))).toBe("a?");
  });
});

// --- (c) one explicit case per node type ----------------------------------

describe("node type coverage", () => {
  test("alternation", () => expect(astOf("a|b").alternatives).toHaveLength(2));
  test("sequence", () => expect((astOf("ab").alternatives[0] as Alternation["alternatives"][number]).elements).toHaveLength(2));
  test("literal", () => expect(firstNode("a")).toMatchObject({ type: "literal", value: "a", codePoint: 97 }));
  test("dot", () => expect(firstNode(".").type).toBe("dot"));
  test("anchor line-start", () => expect(firstNode("^")).toMatchObject({ type: "anchor", kind: "line-start" }));
  test("anchor word-boundary", () => expect(firstNode("\\b")).toMatchObject({ type: "anchor", kind: "word-boundary" }));
  test("char-class", () => expect(firstNode("[abc]")).toMatchObject({ type: "char-class", negated: false }));
  test("class-escape", () => expect(firstNode("\\d")).toMatchObject({ type: "class-escape", letter: "d" }));
  test("unicode-property", () => expect(firstNode("\\p{L}")).toMatchObject({ type: "unicode-property", name: "L", negated: false }));
  test("quantifier", () => expect(firstNode("a*")).toMatchObject({ type: "quantifier", min: 0, max: null, lazy: false }));
  test("group capturing", () => expect(firstNode("(a)")).toMatchObject({ type: "group", capturing: true, index: 1 }));
  test("lookaround", () => expect(firstNode("(?=a)")).toMatchObject({ type: "lookaround", ahead: true, negative: false }));
  test("backreference", () => {
    const seq = astOf("(a)\\1").alternatives[0] as Alternation["alternatives"][number];
    expect(seq.elements[1]).toMatchObject({ type: "backreference", ref: 1 });
  });
});

// --- (d) feature depth -----------------------------------------------------

describe("named groups", () => {
  test("named capture records name + index", () => {
    const g = firstNode("(?<year>\\d{4})") as Group;
    expect(g).toMatchObject({ type: "group", name: "year", index: 1 });
  });
  test("duplicate name across separate alternatives is allowed (ES2025)", () => {
    expect(parseRegex("(?<n>a)|(?<n>b)", "u")).toHaveProperty("ast");
  });
  test("duplicate name in the same alternative is rejected", () => {
    expect(errOf("(?<n>a)(?<n>b)").error).toMatch(/duplicate group name/);
  });
  test("digit-leading group name is rejected", () => {
    expect(errOf("(?<1a>x)").error).toMatch(/invalid group name/);
  });
});

describe("lookbehind", () => {
  test("positive", () => expect(firstNode("(?<=a)b")).toMatchObject({ type: "lookaround", ahead: false, negative: false }));
  test("negative", () => expect(firstNode("(?<!a)b")).toMatchObject({ type: "lookaround", ahead: false, negative: true }));
});

describe("unicode property escapes", () => {
  test("script value form", () => expect(firstNode("\\p{Script=Greek}")).toMatchObject({ name: "Script", value: "Greek" }));
  test("negated lone form", () => expect(firstNode("\\P{L}")).toMatchObject({ negated: true, name: "L" }));
  test("bare \\p is rejected in unicode mode", () => expect(errOf("\\p").error).toMatch(/\\p must be followed/));
});

describe("backreferences", () => {
  test("named backref resolves", () => {
    const seq = astOf("(?<x>a)\\k<x>").alternatives[0] as Alternation["alternatives"][number];
    expect(seq.elements[1]).toMatchObject({ type: "backreference", ref: "x" });
  });
  test("numeric backref with no matching group is rejected", () => expect(errOf("\\1").error).toMatch(/no matching group/));
  test("named backref with no group is rejected", () => expect(errOf("(a)\\k<z>").error).toMatch(/no group/));
});

describe("quantifier forms", () => {
  const cases: [string, Partial<Quantifier>][] = [
    ["a*", { min: 0, max: null, lazy: false }],
    ["a+", { min: 1, max: null, lazy: false }],
    ["a?", { min: 0, max: 1, lazy: false }],
    ["a{3}", { min: 3, max: 3, lazy: false }],
    ["a{2,}", { min: 2, max: null, lazy: false }],
    ["a{2,4}", { min: 2, max: 4, lazy: false }],
    ["a*?", { min: 0, max: null, lazy: true }],
    ["a+?", { min: 1, max: null, lazy: true }],
    ["a{2,4}?", { min: 2, max: 4, lazy: true }],
  ];
  for (const [p, shape] of cases) {
    test(`/${p}/`, () => expect(firstNode(p)).toMatchObject({ type: "quantifier", ...shape }));
  }
  test("double quantifier a** is rejected", () => expect(errOf("a**").error).toMatch(/nothing to repeat/));
  test("reversed bound {2,1} is rejected", () => expect(errOf("a{2,1}").error).toMatch(/lower bound exceeds/));
});

describe("character classes", () => {
  test("range", () => {
    const c = firstNode("[a-z]") as CharClass;
    expect(c.items[0]).toMatchObject({ type: "class-range", from: { value: "a" }, to: { value: "z" } });
  });
  test("negation", () => expect((firstNode("[^0-9]") as CharClass).negated).toBe(true));
  test("class escapes as members", () => {
    const c = firstNode("[\\d\\w\\s]") as CharClass;
    expect(c.items.map((i) => i.type)).toEqual(["class-escape", "class-escape", "class-escape"]);
  });
  test("escaped dash is a literal, not a range operator", () => {
    const c = firstNode("[a\\-z]") as CharClass;
    expect(c.items.every((i) => i.type === "literal")).toBe(true);
    expect(c.items).toHaveLength(3);
  });
  test("leading and trailing dash are literals", () => {
    expect((firstNode("[-a]") as CharClass).items).toHaveLength(2);
    expect((firstNode("[a-]") as CharClass).items).toHaveLength(2);
  });
  test("property inside a class", () => expect((firstNode("[\\p{L}]") as CharClass).items[0]).toMatchObject({ type: "unicode-property" }));
  test("reversed range is rejected", () => expect(errOf("[z-a]").error).toMatch(/out of order/));
  test("class-escape as a range bound is rejected", () => expect(errOf("[a-\\d]").error).toMatch(/range bound/));
});

describe("escape decode (value + codePoint, which printRegex's raw output cannot verify)", () => {
  const cases: [string, number][] = [
    ["\\n", 10],
    ["\\t", 9],
    ["\\0", 0],
    ["\\cA", 1],
    ["\\x41", 0x41],
    ["\\u0041", 0x41],
    ["\\u{1F600}", 0x1f600],
  ];
  for (const [p, codePoint] of cases) {
    test(`/${p}/ decodes to U+${codePoint.toString(16)}`, () => {
      expect(firstNode(p)).toMatchObject({ type: "literal", value: String.fromCodePoint(codePoint), codePoint });
    });
  }

  test("escape-bounded class range exercises the codePoint comparison path", () => {
    const c = firstNode("[\\x41-\\x5A]") as CharClass;
    expect(c.items[0]).toMatchObject({ type: "class-range", from: { codePoint: 0x41 }, to: { codePoint: 0x5a } });
    expect(errOf("[\\x5A-\\x41]").error).toMatch(/out of order/);
  });
});

// --- error offsets + v-flag gate ------------------------------------------

describe("error offsets and the v-flag gate", () => {
  test("`at` points at the offending construct", () => {
    expect(errOf("a{2,1}").at).toBe(1); // the "{"
    expect(errOf("a\\x4").at).toBe(1); // the backslash
    expect(errOf("\\1").at).toBe(0); // the reference
  });
  test("v-flag is staged behind V_MODE_ENABLED", () => {
    expect(V_MODE_ENABLED).toBe(false);
    const r = parseRegex("[a]", "v");
    expect(r).toMatchObject({ at: 0 });
    if (!("ast" in r)) expect(r.error).toMatch(/v-flag/);
  });
});
