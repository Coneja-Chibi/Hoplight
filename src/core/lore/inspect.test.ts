/**
 * One describe per inspect rule + fix idempotence + fix-then-rescan-zero for fixable rules.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookBody, LorebookEntry } from "../../entities/lorebook/schema";
import { emptyLoreEntry, emptyLorebookBody } from "./empty-book";
import { applyAllFixes, inspectBook, type LoreFinding } from "./inspect";

const entry = (id: string, patch: Partial<LorebookEntry> = {}): LorebookEntry => ({
  ...emptyLoreEntry(id),
  ...patch,
  id,
});

const bookOf = (entries: LorebookEntry[], patch: Partial<LorebookBody> = {}): LorebookBody => ({
  ...emptyLorebookBody("inspect"),
  entries,
  ...patch,
});

const rulesOf = (book: LorebookBody) => inspectBook(book).map((f) => f.rule);

const findingsFor = (book: LorebookBody, rule: LoreFinding["rule"]) =>
  inspectBook(book).filter((f) => f.rule === rule);

describe("inspectBook: broken-data", () => {
  test("empty title+content is a problem", () => {
    const b = bookOf([entry("e", { title: "", content: "" })]);
    expect(findingsFor(b, "broken-data").some((f) => f.entryId === "e")).toBe(true);
  });

  test("broken regex key is a problem", () => {
    const b = bookOf([
      entry("e", {
        title: "R",
        content: "x",
        triggers: [{ keyword: "(unclosed", isRegex: true }],
      }),
    ]);
    expect(findingsFor(b, "broken-data")[0]?.message).toContain("broken regex");
  });
});

describe("inspectBook: broken-numbering", () => {
  test("duplicate sortOrder gets a book-level finding with fix", () => {
    const b = bookOf([
      entry("a", { title: "A", content: "a", sortOrder: 10 }),
      entry("b", { title: "B", content: "b", sortOrder: 10 }),
    ]);
    const f = findingsFor(b, "broken-numbering");
    expect(f).toHaveLength(1);
    expect(f[0]?.fix).toBeDefined();
    const fixed = f[0]!.fix!(b);
    expect(fixed.entries.map((e) => e.sortOrder)).toEqual([0, 10]);
  });
});

describe("inspectBook: duplicate-key", () => {
  test("shared primary key flags both owners", () => {
    const b = bookOf([
      entry("a", {
        title: "A",
        content: "a",
        triggers: [{ keyword: "moon", isRegex: false }],
      }),
      entry("b", {
        title: "B",
        content: "b",
        triggers: [{ keyword: "Moon", isRegex: false }],
      }),
    ]);
    const f = findingsFor(b, "duplicate-key");
    expect(f.map((x) => x.entryId).sort()).toEqual(["a", "b"]);
  });
});

describe("inspectBook: chance-contradiction", () => {
  test("constant + probability < 100 is fixable to 100", () => {
    const b = bookOf([
      entry("c", {
        title: "C",
        content: "always",
        constant: true,
        probability: 40,
      }),
    ]);
    const f = findingsFor(b, "chance-contradiction");
    expect(f).toHaveLength(1);
    const fixed = f[0]!.fix!(b);
    expect(fixed.entries[0]?.probability).toBe(100);
    expect(findingsFor(fixed, "chance-contradiction")).toHaveLength(0);
  });
});

describe("inspectBook: legacy-leftovers", () => {
  test("metadata.keys is flagged", () => {
    const b = bookOf([
      entry("e", {
        title: "E",
        content: "c",
        metadata: { keys: ["old"] },
      }),
    ]);
    expect(findingsFor(b, "legacy-leftovers")[0]?.entryId).toBe("e");
  });
});

describe("inspectBook: key-points-nowhere", () => {
  test("secondary keys with no cross-entry mention", () => {
    const b = bookOf([
      entry("a", {
        title: "A",
        content: "nothing relevant",
        triggers: [{ keyword: "alpha", isRegex: false }],
        secondaryTriggers: [{ keyword: "zzz-unique", isRegex: false }],
      }),
      entry("b", {
        title: "B",
        content: "also nothing",
        triggers: [{ keyword: "beta", isRegex: false }],
      }),
    ]);
    expect(findingsFor(b, "key-points-nowhere").some((f) => f.entryId === "a")).toBe(true);
  });
});

describe("inspectBook: wakes-itself", () => {
  test("content containing own key is fixable", () => {
    const b = bookOf([
      entry("e", {
        title: "E",
        content: "The word spark appears here.",
        triggers: [{ keyword: "spark", isRegex: false }],
        matchWholeWords: true,
      }),
    ]);
    const f = findingsFor(b, "wakes-itself");
    expect(f).toHaveLength(1);
    const fixed = f[0]!.fix!(b);
    expect(fixed.entries[0]?.triggers).toHaveLength(0);
    expect(findingsFor(fixed, "wakes-itself")).toHaveLength(0);
  });
});

describe("inspectBook: never-woken", () => {
  test("entry only reachable from chat, not other entries", () => {
    const b = bookOf([
      entry("a", {
        title: "A",
        content: "hello",
        triggers: [{ keyword: "unique-chat-key-xyz", isRegex: false }],
      }),
      entry("b", {
        title: "B",
        content: "world",
        triggers: [{ keyword: "other-key", isRegex: false }],
      }),
    ]);
    expect(findingsFor(b, "never-woken").some((f) => f.entryId === "a")).toBe(true);
  });

  test("entry woken by another entry's content is not flagged", () => {
    const b = bookOf([
      entry("a", {
        title: "A",
        content: "mentions bravo clearly",
        triggers: [{ keyword: "alpha", isRegex: false }],
      }),
      entry("b", {
        title: "B",
        content: "end",
        triggers: [{ keyword: "bravo", isRegex: false }],
      }),
    ]);
    expect(findingsFor(b, "never-woken").some((f) => f.entryId === "b")).toBe(false);
  });
});

describe("inspectBook: never-fires", () => {
  test("probability 0", () => {
    const b = bookOf([
      entry("e", {
        title: "E",
        content: "c",
        probability: 0,
        triggers: [{ keyword: "x", isRegex: false }],
      }),
    ]);
    expect(findingsFor(b, "never-fires")[0]?.entryId).toBe("e");
  });

  test("enabled keyword entry with empty triggers and not constant", () => {
    const b = bookOf([
      entry("e", {
        title: "E",
        content: "c",
        constant: false,
        triggers: [],
        secondaryTriggers: [],
      }),
    ]);
    expect(findingsFor(b, "never-fires").some((f) => f.entryId === "e")).toBe(true);
  });
});

describe("inspectBook: fix idempotence and rescan", () => {
  test("fix(fix(b)) deep-equals fix(b) for renumber", () => {
    const b = bookOf([
      entry("a", { title: "A", content: "a", sortOrder: 5 }),
      entry("b", { title: "B", content: "b", sortOrder: 5 }),
    ]);
    const f = findingsFor(b, "broken-numbering")[0]!;
    const once = f.fix!(b);
    const twice = f.fix!(once);
    expect(twice).toEqual(once);
  });

  test("applyAllFixes then rescan clears fixable chance + numbering", () => {
    const b = bookOf([
      entry("a", {
        title: "A",
        content: "a",
        sortOrder: 1,
        constant: true,
        probability: 10,
      }),
      entry("b", {
        title: "B",
        content: "b",
        sortOrder: 1,
        triggers: [{ keyword: "b", isRegex: false }],
      }),
    ]);
    const before = inspectBook(b);
    const afterBook = applyAllFixes(b, before);
    const after = inspectBook(afterBook);
    expect(after.filter((f) => f.rule === "chance-contradiction")).toHaveLength(0);
    expect(after.filter((f) => f.rule === "broken-numbering")).toHaveLength(0);
  });

  test("rulesOf on a clean minimal book is empty or only never-woken worth-a-look", () => {
    const b = bookOf([
      entry("c", {
        title: "C",
        content: "steady",
        constant: true,
      }),
    ]);
    const rules = rulesOf(b);
    expect(rules.every((r) => r === "never-woken")).toBe(true);
  });
});
