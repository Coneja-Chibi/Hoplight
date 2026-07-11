/**
 * NL builder core: buildFromPhrases / explainPattern (REGEX-JEWEL-PLAN.md Phase R3
 * prerequisite). The round-trip suite runs the vocabulary against RC's real template catalog
 * patterns (`apps/rc/src/lib/regex/templates.ts` findPattern/flags pairs, copied as bare data
 * fixtures here per the plan's "do not port the catalog itself" - no RegexTemplate shape, no
 * descriptions, just the pattern corpus to prove stability against real-world regexes).
 */
import { describe, expect, test } from "bun:test";
import { buildFromPhrases, explainPattern } from "./builder";

describe("buildFromPhrases", () => {
  test("empty input builds nothing", () => {
    expect(buildFromPhrases([])).toEqual({ find: "", flags: "" });
  });

  test("blank/whitespace-only phrases are dropped", () => {
    expect(buildFromPhrases(["", "  ", "\t"])).toEqual({ find: "", flags: "" });
  });

  test("single word wraps in whole-word boundaries, default case-insensitive", () => {
    expect(buildFromPhrases(["cat"])).toEqual({ find: "\\bcat\\b", flags: "i" });
  });

  test("caseSensitive option drops the i flag", () => {
    expect(buildFromPhrases(["cat"], { caseSensitive: true })).toEqual({
      find: "\\bcat\\b",
      flags: "",
    });
  });

  test("multiple words group as an alternation, deduped", () => {
    const built = buildFromPhrases(["cat", "dog", "cat"]);
    expect(built.flags).toBe("i");
    expect(built.find).toMatch(/^\\b\([^)]+\)\\b$/);
    expect(explainPattern(built.find, built.flags).phrases.sort()).toEqual(["cat", "dog"]);
  });

  test("longer alternatives sort before their prefixes so the full word wins", () => {
    const built = buildFromPhrases(["cat", "catastrophe"]);
    const re = new RegExp(built.find, built.flags);
    expect("catastrophe".match(re)?.[0]).toBe("catastrophe");
  });

  test("regex specials in a phrase are escaped, not interpreted", () => {
    const built = buildFromPhrases(["a.b*c"]);
    const re = new RegExp(built.find, built.flags);
    expect(re.test("a.b*c")).toBe(true);
    expect(re.test("aXbYc")).toBe(false);
  });

  test("multi-word phrases survive as literal spaced text", () => {
    const built = buildFromPhrases(["is it raining"]);
    const re = new RegExp(built.find, built.flags);
    expect(re.test("is it raining today")).toBe(true);
    expect(re.test("is it snowing")).toBe(false);
  });
});

describe("explainPattern", () => {
  test("empty find explains as empty, complete", () => {
    expect(explainPattern("", "")).toEqual({ phrases: [], complete: true });
  });

  test("build -> explain recovers the exact phrase set, complete", () => {
    const built = buildFromPhrases(["cat", "dog"]);
    const explained = explainPattern(built.find, built.flags);
    expect(explained.complete).toBe(true);
    expect(explained.note).toBeUndefined();
    expect([...explained.phrases].sort()).toEqual(["cat", "dog"]);
  });

  test("build -> explain recovers a single-word pattern", () => {
    const built = buildFromPhrases(["cat"]);
    const explained = explainPattern(built.find, built.flags);
    // R2X integration widened ExplainResult with the AST explainer's full `reading` (QOL 20);
    // the vocabulary contract (phrases/complete/note) is unchanged - assert it precisely, then
    // the new field's presence for a parseable pattern.
    expect(explained).toMatchObject({ phrases: ["cat"], complete: true });
    expect(explained.note).toBeUndefined();
    expect(typeof explained.reading).toBe("string");
    expect(explained.reading!.length).toBeGreaterThan(0);
  });

  test("R2X: the full reading is present even for patterns outside the vocabulary", () => {
    const explained = explainPattern("^\\[status\\][\\s\\S]*?\\[\\/status\\]$", "gm");
    expect(explained.complete).toBe(false);
    expect(typeof explained.reading).toBe("string");
    // the mechanical reading names the literal pieces the vocabulary cannot
    expect(explained.reading).toContain("[status]");
  });

  test("a pattern outside the vocabulary is marked partial with an honest note", () => {
    const explained = explainPattern("\\b(alice|bob|charlie)\\b", "gi"); // 'g' flag = foreign
    expect(explained.complete).toBe(false);
    expect(explained.note).toBeDefined();
    expect(explained.phrases.sort()).toEqual(["alice", "bob", "charlie"]);
  });

  test("a pattern with no recoverable words explains as empty, partial", () => {
    const explained = explainPattern("[ \\t]+$", "gm");
    expect(explained.complete).toBe(false);
    expect(explained.phrases).toEqual([]);
  });

  test("never fabricates a word the pattern does not contain", () => {
    const explained = explainPattern("\\d{4}-\\d{2}-\\d{2}", "g");
    expect(explained.phrases.every((w) => /^[a-zA-Z']+$/.test(w))).toBe(true);
    for (const w of explained.phrases) {
      expect("\\d{4}-\\d{2}-\\d{2}".includes(w)).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// Round-trip stability over RC's template catalog patterns
// ----------------------------------------------------------------------------
// findPattern/flags pairs copied from apps/rc/src/lib/regex/templates.ts (REGEX_TEMPLATES),
// data only - no RegexTemplate shape, no descriptions/categories/examples ported.
const RC_TEMPLATE_PATTERNS: readonly { find: string; flags: string }[] = [
  { find: "\\(\\s*OOC[:\\s][^)]*\\)|\\[\\s*OOC[:\\s][^\\]]*\\]|\\(\\([^)]+\\)\\)", flags: "gi" },
  { find: "\\*[^*]+\\*", flags: "g" },
  { find: '"([^"]+)"', flags: "g" },
  { find: "\\n{3,}", flags: "g" },
  { find: "[ \\t]+$", flags: "gm" },
  { find: "\\*([^*]+)\\*", flags: "g" },
  { find: "[“”„‟″‶]", flags: "g" },
  { find: "[‘’‚‛′‵]", flags: "g" },
  { find: "—", flags: "g" },
  { find: "--", flags: "g" },
  {
    find: '^([A-Z][^.!?]*(?:said|asked|whispered|shouted|replied|muttered)[,:]?)\\s+([A-Z][^"]+)$',
    flags: "gm",
  },
  {
    find:
      "^((?:He|She|They|It|The [a-z]+)\\s+(?:walk|run|look|smile|laugh|sigh|nod|shake|step|move|turn|watch|stand|sit|lean)[a-z]*[^.]*\\.)$",
    flags: "gim",
  },
  { find: "\\b(alice|bob|charlie)\\b", flags: "gi" },
  { find: "!{2,}", flags: "g" },
  { find: "\\.{2,}|…+", flags: "g" },
  { find: " {2,}", flags: "g" },
  { find: "\\b(damn|hell|crap)\\b", flags: "gi" },
  { find: "\\b(hate|kill|destroy|murder)\\b", flags: "gi" },
  { find: "\\*\\*([^*]+)\\*\\*", flags: "g" },
  { find: "\\*\\*([^*]+)\\*\\*|\\*([^*]+)\\*|_([^_]+)_|`([^`]+)`", flags: "g" },
  { find: "\\r\\n", flags: "g" },
  {
    find:
      "\\b(I apologize|I'm sorry|As an AI|I cannot|I'm not able to|I don't have the ability)\\b[^.!?]*[.!?]?\\s*",
    flags: "gi",
  },
  { find: '"\\s*"|\'\'|""', flags: "g" },
  {
    find:
      "<thinking>[\\s\\S]*?</thinking>|<internal>[\\s\\S]*?</internal>|\\[thinking\\][\\s\\S]*?\\[/thinking\\]|\\[internal\\][\\s\\S]*?\\[/internal\\]",
    flags: "gi",
  },
  {
    find: "\\[INST\\]|\\[/INST\\]|<<SYS>>|<</SYS>>|<\\|im_start\\|>|<\\|im_end\\|>|<\\|user\\|>|<\\|assistant\\|>",
    flags: "gi",
  },
  { find: "\\b(\\w+)\\s+\\1\\b", flags: "gi" },
  { find: "\\bI\\b", flags: "g" },
  { find: "\\bmy\\b", flags: "gi" },
  { find: "\\[(?:Scene|Location|Time|Setting|Mood|Music|Atmosphere|Note|Author|AN)[:\\s][^\\]]*\\]", flags: "gi" },
  { find: '"([^"]*)"', flags: "g" },
  { find: '\\[Narrator\\][:\\s]*|\\*Narrator[:\\s]*\\*|Narrator[:\\s]+', flags: "gi" },
  { find: '([.!?]")\\s+([A-Z])', flags: "g" },
  { find: "(\\w+),\\s+(\\w+)\\s+and\\s+(\\w+)", flags: "gi" },
  { find: "\\b(\\w+ly)\\b", flags: "g" },
  { find: "\\b(just|really|very|actually|basically|literally|simply|definitely|certainly)\\s+", flags: "gi" },
  { find: "\\bdon't\\b", flags: "gi" },
  { find: "\\bdo not\\b", flags: "gi" },
  { find: "<[^>]+>", flags: "g" },
  { find: "&(?!amp;|lt;|gt;|quot;)", flags: "g" },
  { find: "→", flags: "g" },
  { find: "[\\u200B-\\u200D\\uFEFF\\u00AD]", flags: "g" },
  { find: "\\{\\{user\\}\\}", flags: "gi" },
  { find: "\\{\\{char\\}\\}", flags: "gi" },
  { find: "(function|const|let|var|import|export|class|def|print)\\s+[^\\n]+", flags: "gm" },
  { find: "\\b(John|Jane|Michael|Sarah|David|Emily|James|Emma|Robert|Lisa)\\b", flags: "gi" },
  {
    find: "\\[?\\d{1,2}[:\\/]\\d{2}(?:[:\\/]\\d{2})?(?:\\s*[AP]M)?\\]?|\\d{4}-\\d{2}-\\d{2}",
    flags: "gi",
  },
];

describe("round-trip stability over RC's template catalog", () => {
  for (const [i, { find, flags }] of RC_TEMPLATE_PATTERNS.entries()) {
    test(`template #${i}: one build/explain cycle reaches a fixed point`, () => {
      // The first explain of a FOREIGN pattern reports words in extraction order; the first
      // build then reorders them (longest-first, per buildFromPhrases's own grammar) - so
      // round 1 is not expected to preserve extraction order. What must hold: from round 1
      // onward, the cycle is a fixed point (round 2 reproduces round 1 exactly).
      const round0 = explainPattern(find, flags);
      const built1 = buildFromPhrases(round0.phrases);
      const round1 = explainPattern(built1.find, built1.flags);
      const built2 = buildFromPhrases(round1.phrases);
      const round2 = explainPattern(built2.find, built2.flags);

      expect(round2.phrases).toEqual(round1.phrases);
      // Whatever buildFromPhrases emits is always fully explainable by construction.
      expect(round1.complete).toBe(true);
      expect(round2.complete).toBe(true);
    });
  }
});
