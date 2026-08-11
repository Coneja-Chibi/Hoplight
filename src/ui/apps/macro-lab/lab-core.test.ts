/**
 * The reading half, checked against the catalogs it reads.
 *
 * The assertions that matter here are the ones about CONFIDENCE. A macro lab is a place people come
 * to find out whether something works, so every way this file could overstate what it knows is worth
 * an assertion: a comment printed as a supported macro, a name present on two engines printed as
 * "travels fine", a nested lookup lost inside its container.
 */
import { describe, expect, it } from "bun:test";
import { PRESET_WRITE_FOR_PROFILES } from "../../../core/preset/capabilities";
import {
  bibleFor,
  bibleSize,
  dialectTranslates,
  noTranslationNote,
  OPERATION_ABSENT,
  OPERATION_LENSES,
  buildResolveAsk,
  filterBible,
  insertToken,
  LAB_LENSES,
  operationRows,
  readMacros,
  travelFor,
  VERDICT_LABEL,
} from "./lab-core";

describe("readMacros", () => {
  it("says nothing at all about text with no macros in it", () => {
    const out = readMacros("just some prose", "sillytavern");
    expect(out.empty).toBe(true);
    expect(out.tokens).toEqual([]);
    expect(out.unknownNames).toEqual([]);
  });

  it("reads a macro the lens carries, and quotes the catalog rather than paraphrasing", () => {
    const out = readMacros("Hello {{char}}", "sillytavern");
    expect(out.tokens).toHaveLength(1);
    const [row] = out.tokens;
    expect(row!.name).toBe("char");
    expect(row!.verdict).toBe("known");
    expect(row!.description).toBeTruthy();
  });

  it("names what the lens has no macro for, without swallowing it", () => {
    const out = readMacros("{{char}} and {{hoplight_not_a_macro}}", "sillytavern");
    expect(out.tokens.map((t) => t.verdict)).toEqual(["known", "unknown"]);
    expect(out.unknownNames).toEqual(["hoplight_not_a_macro"]);
  });

  /**
   * THE LENIENCY GUARD. isMacroSupported answers true for a token that invokes no name, so a
   * compatibility check never calls a comment dead. Carrying that onto the screen would print a
   * comment as a macro this engine supports.
   */
  it("calls a token that invokes nothing exactly that, never 'supported'", () => {
    const out = readMacros("{{// just a note}}", "sillytavern");
    expect(out.tokens).toHaveLength(1);
    expect(out.tokens[0]!.verdict).toBe("invokes-nothing");
    expect(out.tokens[0]!.name).toBe("");
    expect(VERDICT_LABEL["invokes-nothing"]).not.toContain("catalog");
  });

  it("reports a nested macro as well as the one containing it, and says which is which", () => {
    const out = readMacros("{{if::{{getvar::x}}::yes::no}}", "rolecall");
    const shape = out.tokens.map((t) => ({ name: t.name, depth: t.depth }));
    // Outer first, then what is inside it: the order scanMacroTree already guarantees.
    expect(shape[0]).toEqual({ name: "if", depth: 0 });
    expect(shape.some((s) => s.name === "getvar" && s.depth === 1)).toBe(true);
  });

  it("does not report the same unknown name twice, however often it is typed", () => {
    const out = readMacros("{{zzz}} {{zzz}} {{zzz}}", "sillytavern");
    expect(out.tokens).toHaveLength(3);
    expect(out.unknownNames).toEqual(["zzz"]);
  });

  it("answers per lens, because the catalogs really do differ", () => {
    // The point of five catalogs rather than one filtered list: the same text reads differently.
    // Marinara's macro set is much smaller than SillyTavern's, and this is one it does not carry.
    const text = "{{lastMessage}}";
    expect(readMacros(text, "sillytavern").tokens[0]!.verdict).toBe("known");
    expect(readMacros(text, "marinara").tokens[0]!.verdict).toBe("unknown");
  });

  it("survives an unmatched opener instead of throwing on it", () => {
    const out = readMacros("a {{char", "sillytavern");
    expect(out.empty).toBe(true);
  });
});

describe("travelFor", () => {
  it("gives one row per other lens and never one for the lens asked from", () => {
    const rows = travelFor("{{char}}", "sillytavern");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.lens === "sillytavern")).toBe(false);
  });

  it("carries a macro every engine has straight across", () => {
    const rows = travelFor("{{char}}", "sillytavern");
    for (const row of rows) expect(row.becomes).toBeTruthy();
  });

  /**
   * THE COLLISION GUARD, and the reason this asks the translator rather than two catalogs.
   * `{{random}}` exists by name on SillyTavern and Marinara and means a different thing on each. A
   * name-presence answer would print "travels fine" over the exact case that silently does not, so
   * the row must carry the translator's flag and its reason instead.
   */
  it("does not call a known collision a clean trip", () => {
    const rows = travelFor("{{random::a::b}}", "sillytavern");
    const mar = rows.find((r) => r.lens === "marinara");
    expect(mar).toBeDefined();
    expect(mar!.kind).toBe("collision");
    expect(mar!.why).toContain("does something else");
  });

  it("shows a rewrite as the form the other engine actually needs", () => {
    // Same operation, different spelling: the row is only useful if it carries the new token.
    const rows = travelFor("{{random::a::b}}", "sillytavern");
    const lumi = rows.find((r) => r.lens === "lumiverse");
    expect(lumi!.kind).toBe("rewrite");
    expect(lumi!.becomes).toBe("{{pick::a::b}}");
  });

  it("says so plainly when a token has nowhere to go on a lens", () => {
    const rows = travelFor("{{hoplight_not_a_macro}}", "sillytavern");
    // Whatever the verdict, every row must carry a reason a person can read.
    for (const row of rows) expect(row.why.length).toBeGreaterThan(0);
  });
});

/**
 * The rules that turn a filled-in panel into something an engine is told.
 *
 * These live here rather than in the render test because react-dom decides at IMPORT time whether it
 * can use `input` events, and in this suite it is first imported before any document exists - so a
 * simulated keystroke reaches onInput and never reaches onChange, for every component in the process.
 * That is a property of the harness, not of this app, and the answer is to keep the rules somewhere
 * they can be proven directly rather than to write assertions that only pass in isolation.
 */
describe("buildResolveAsk", () => {
  const empty = { user: "", char: "", vars: [] };

  it("sends nothing but the engine and the text when nothing was filled in", () => {
    const ask = buildResolveAsk("sillytavern", "hi", empty);
    expect(ask).toEqual({ engine: "sillytavern", text: "hi" });
  });

  it("omits identity rather than naming somebody the empty string", () => {
    // The difference is real: absent lets each adapter keep its own placeholder, while
    // { user: "" } names the empty string and resolves {{user}} to nothing at all.
    const ask = buildResolveAsk("marinara", "x", { ...empty, user: "   " });
    expect(ask.identity).toBeUndefined();
  });

  it("names only the side that was filled in", () => {
    const ask = buildResolveAsk("marinara", "x", { ...empty, char: "Seraphina" });
    expect(ask.identity).toEqual({ char: "Seraphina" });
  });

  it("trims a name, because trailing space is not part of who somebody is", () => {
    const ask = buildResolveAsk("marinara", "x", { user: " Chi ", char: "", vars: [] });
    expect(ask.identity).toEqual({ user: "Chi" });
  });

  it("drops a variable row nobody has named yet", () => {
    const ask = buildResolveAsk("marinara", "x", {
      ...empty,
      vars: [{ key: "", value: "orphan" }, { key: " mood ", value: "calm" }],
    });
    expect(ask.state).toEqual({ mood: "calm" });
  });

  it("keeps a variable deliberately set to nothing", () => {
    // Setting a variable empty is a real thing to test, and is not the same as never setting it.
    const ask = buildResolveAsk("marinara", "x", { ...empty, vars: [{ key: "mood", value: "" }] });
    expect(ask.state).toEqual({ mood: "" });
  });

  it("omits state entirely when every row is blank", () => {
    const ask = buildResolveAsk("marinara", "x", { ...empty, vars: [{ key: "", value: "" }] });
    expect(ask.state).toBeUndefined();
  });

  it("passes the text through exactly, whitespace and all", () => {
    const text = "  {{char}}\n\n  ";
    expect(buildResolveAsk("marinara", text, empty).text).toBe(text);
  });
});

describe("LAB_LENSES", () => {
  /**
   * The lab shows platforms, and "Hoplight" is not one. `full` is the canonical superset lens whose
   * catalog IS RoleCall's, so offering it here meant a duplicate column under a name with no engine
   * behind it - and a verdict reading "in this engine's catalog" about an engine that does not exist.
   */
  it("offers no Hoplight lens, because Hoplight runs no macros", () => {
    expect(LAB_LENSES).not.toContain("full");
    expect(LAB_LENSES).toEqual(
      ["rolecall", "sillytavern", "sillytavern-new", "marinara", "lumiverse", "risu"],
    );
  });

  it("never routes a travel row through it either", () => {
    // The duplicate would otherwise reappear here: `full` and `rolecall` answer identically.
    expect(travelFor("{{char}}", "sillytavern").some((r) => r.lens === "full")).toBe(false);
  });

  it("leaves the write-for profiles alone, which the Workbench still needs whole", () => {
    expect(PRESET_WRITE_FOR_PROFILES).toContain("full");
  });
});

describe("insertToken", () => {
  it("drops the token at the caret", () => {
    expect(insertToken("ab", "{{char}}", 1, 1)).toEqual({ text: "a{{char}}b", caret: 9 });
  });

  it("replaces a selection rather than pushing it aside", () => {
    expect(insertToken("hello world", "{{char}}", 0, 5).text).toBe("{{char}} world");
  });

  it("handles a backwards selection, which a drag to the left produces", () => {
    expect(insertToken("hello", "X", 4, 1)).toEqual({ text: "hXo", caret: 2 });
  });

  it("appends when the box has never been focused", () => {
    expect(insertToken("abc", "{{x}}", 3, 3).text).toBe("abc{{x}}");
  });

  /**
   * A caret index can be stale by the time a click lands - the text may have shrunk under it.
   * Clamping appends; refusing would throw away the macro somebody just asked for.
   */
  it("clamps a stale or nonsense position instead of losing the insert", () => {
    expect(insertToken("abc", "X", 99, 99).text).toBe("abcX");
    expect(insertToken("abc", "X", -5, -5).text).toBe("Xabc");
    expect(insertToken("", "X", 0, 0)).toEqual({ text: "X", caret: 1 });
  });
});

describe("operationRows", () => {
  it("is derived from the catalogs, so every row has at least one real spelling", () => {
    const rows = operationRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.carriedBy).toBeGreaterThan(0);
  });

  it("gives every column a cell, present or not, so a gap cannot be mistaken for a missing column", () => {
    // OPERATION_LENSES, not LAB_LENSES: a dialect with no operation annotations has no column at
    // all rather than a column of "none", which would report our gap as the engine's.
    for (const row of operationRows()) {
      expect(row.byLens.map((c) => c.lens)).toEqual([...OPERATION_LENSES]);
    }
  });

  /** The gaps are the finding, so they sort to where they get read. */
  it("puts the least portable operations first", () => {
    const counts = operationRows().map((r) => r.carriedBy);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
  });

  it("keeps a real known gap: only one platform counts the whole prompt's tokens", () => {
    const row = operationRows().find((r) => r.op === "prompt.tokencount");
    expect(row).toBeDefined();
    const withIt = row!.byLens.filter((c) => c.forms.length > 0).map((c) => c.lens);
    expect(withIt).toEqual(["rolecall"]);
  });

  it("carries a collision as two spellings of two different operations, not one row", () => {
    // {{random::a::b}} is a pick on SillyTavern and a range on RoleCall. If ops collapsed them the
    // table would show agreement over the exact case that silently breaks.
    const pick = operationRows().find((r) => r.op === "random.pick");
    const range = operationRows().find((r) => r.op === "random.range");
    expect(pick).toBeDefined();
    expect(range).toBeDefined();
    expect(range!.byLens.find((c) => c.lens === "sillytavern")!.forms).toEqual([]);
  });
});

describe("filterBible", () => {
  const groups = bibleFor("sillytavern");

  it("returns everything when nothing was asked for", () => {
    expect(filterBible(groups, "   ")).toEqual(groups);
  });

  it("matches a macro by name", () => {
    const hits = filterBible(groups, "char").flatMap((g) => g.macros);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((m) => m.macro.includes("char"))).toBe(true);
  });

  it("matches on meaning, because the name is the part somebody does not know yet", () => {
    const hits = filterBible(groups, "random").flatMap((g) => g.macros);
    expect(hits.some((m) => !m.macro.toLowerCase().includes("random"))).toBe(true);
  });

  it("drops groups it emptied instead of leaving bare headings", () => {
    for (const group of filterBible(groups, "char")) {
      expect(group.macros.length).toBeGreaterThan(0);
    }
  });

  it("answers nothing for a search nothing matches", () => {
    expect(filterBible(groups, "zzzz-not-a-macro")).toEqual([]);
  });
});

describe("the Risu dialect in the lab", () => {
  it("is offered as a platform, so its macro library is reachable with no checkout", () => {
    expect(LAB_LENSES).toContain("risu");
    expect(bibleSize("risu")).toBeGreaterThan(100);
  });

  it("reads text like any other dialect", () => {
    const out = readMacros("{{char}} and {{hoplight_not_a_macro}}", "risu");
    expect(out.tokens.map((t) => t.verdict)).toEqual(["known", "unknown"]);
  });

  /**
   * Two absences that must be DELIBERATE, because both would otherwise read as findings about the
   * engine rather than gaps in our model: an empty travel list says "this macro goes nowhere", and a
   * column of "none" says "RisuAI cannot do randomness or conditionals". Both are false.
   */
  it("offers no travel answers rather than empty ones", () => {
    expect(dialectTranslates("risu")).toBe(false);
    expect(travelFor("{{char}}", "risu")).toEqual([]);
  });

  it("is left out of the operations table, and named as left out", () => {
    expect(OPERATION_LENSES).not.toContain("risu");
    expect(OPERATION_ABSENT.unmapped).toEqual(["risu"]);
    for (const row of operationRows()) {
      expect(row.byLens.some((c) => c.lens === "risu")).toBe(false);
    }
  });

  it("never becomes a travel TARGET either, for the same reason", () => {
    // A row reading "RisuAI: the same token works there" would be a portability promise made from
    // name matching alone - the exact check {{random::a::b}} defeats.
    expect(travelFor("{{char}}", "sillytavern").some((r) => r.lens === "risu")).toBe(false);
  });

  it("says on screen why, rather than leaving the absence to be inferred", () => {
    expect(noTranslationNote("risu")).toContain("RisuAI");
    expect(noTranslationNote("risu")).toContain("operation annotations");
    // The other reason, said differently: this engine IS modelled, it just is not a destination.
    expect(noTranslationNote("sillytavern-new")).toContain("two macro engines");
    expect(noTranslationNote("sillytavern-new")).not.toContain("RisuAI");
  });
});

describe("both SillyTavern engines in the lab", () => {
  it("offers each as its own platform", () => {
    expect(LAB_LENSES).toContain("sillytavern");
    expect(LAB_LENSES).toContain("sillytavern-new");
    expect(bibleSize("sillytavern-new")).toBeGreaterThan(0);
    expect(bibleSize("sillytavern-new")).not.toBe(bibleSize("sillytavern"));
  });

  /**
   * The two are excluded from the operations table for DIFFERENT reasons, and the screen says
   * which: Risu has no operation annotations at all, the new SillyTavern has the same ones as the
   * old. Collapsing those into one message would call a mapped engine unmapped.
   */
  it("keeps the two kinds of missing column apart", () => {
    expect(OPERATION_ABSENT.unmapped).toEqual(["risu"]);
    expect(OPERATION_ABSENT.duplicate).toEqual(["sillytavern-new"]);
    expect(OPERATION_LENSES).not.toContain("sillytavern-new");
  });

  it("reads the new engine's own macros, which the old catalog does not have", () => {
    expect(readMacros("{{varexists}}", "sillytavern-new").tokens[0]!.verdict).toBe("known");
    expect(readMacros("{{varexists}}", "sillytavern").tokens[0]!.verdict).toBe("unknown");
  });

  it("does not offer travel from the new engine, and says why", () => {
    expect(dialectTranslates("sillytavern-new")).toBe(false);
    expect(travelFor("{{char}}", "sillytavern-new")).toEqual([]);
  });
});
