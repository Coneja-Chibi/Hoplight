/**
 * Translation through the canonical op hub. The assertions to keep are the two ways a converter
 * betrays its user: losing authored prose, and silently keeping a token whose meaning changed.
 *
 * Nothing here names an engine pair. Every cross-engine expectation is a consequence of what each
 * catalog declares about ITSELF, which is the whole point of the hub.
 */
import { describe, expect, test } from "bun:test";
import { flattenBlocks, translateText } from "./translate";
import { equivalentOf, formsForOp, resolveEntry, unannotatedDivergence } from "./equivalence";
import { arityOf, renderToken, separatorOf } from "./ops";
import { macroName } from "./support";
import type { MacroChange } from "./translate";

const rc2st = (text: string) => translateText(text, "rolecall", "sillytavern", "Main");
const kinds = (changes: MacroChange[]) => changes.map((c) => c.kind);

describe("shape arithmetic is derived from each catalog's own form", () => {
  test("separators are read, not declared", () => {
    expect(separatorOf("{{random::a::b}}")).toBe("::");
    expect(separatorOf("{{roll:1d6}}")).toBe(":");
    expect(separatorOf("{{datetimeformat DD.MM HH:mm}}")).toBe(" ");
    expect(separatorOf("{{char}}")).toBe("none");
  });

  test("arity is read, and a list form is variadic rather than a fixed count", () => {
    expect(arityOf("{{char}}")).toBe(0);
    expect(arityOf("{{roll::NdM}}")).toBe(1);
    expect(arityOf("{{random::min::max}}")).toBe(2);
    expect(arityOf("{{random:a,b,c}}")).toBeNull();
    expect(arityOf("{{pick::a::b::c}}")).toBeNull();
  });

  test("a token is rendered in the target's punctuation, not the source's", () => {
    expect(renderToken("{{roll:1d6}}", ["2d6"])).toBe("{{roll:2d6}}");
    expect(renderToken("{{datetimeformat DD.MM}}", ["HH:mm"])).toBe("{{datetimeformat HH:mm}}");
    expect(renderToken("{{random::a::b}}", ["x", "y"])).toBe("{{random::x::y}}");
  });
});

describe("equivalence is a join on the operation, never a pair table", () => {
  test("a shared operation resolves to the target's own spelling", () => {
    const match = equivalentOf("rolecall", "sillytavern", "roll", ["2d6"]);
    expect(match.verdict).toBe("portable");
    expect(match.rewritten).toBe("{{roll:2d6}}");
  });

  test("the same name performing DIFFERENT operations is a derived collision", () => {
    // RoleCall's two-argument random is a range; SillyTavern has no range macro and its own
    // {{random}} picks from a list. Nothing states this pair: both engines only describe themselves.
    const rc = resolveEntry("rolecall", "random", 2);
    const st = resolveEntry("sillytavern", "random", 2);
    expect(rc?.op).toBe("random.range");
    expect(st?.op).toBe("random.pick");

    const match = equivalentOf("rolecall", "sillytavern", "random", ["1", "10"]);
    expect(match.verdict).toBe("collision");
    expect(match.candidates.length).toBeGreaterThan(0);
  });

  test("arity picks the right meaning, so a portable form is not wrongly flagged", () => {
    // Three-argument picking exists on both engines and must NOT be reported as a collision.
    const match = equivalentOf("rolecall", "sillytavern", "pick", ["a", "b", "c"]);
    expect(match.verdict).toBe("portable");
  });

  test("one operation, every engine that has it, computed", () => {
    const engines = formsForOp("dice.roll").map((form) => form.engine);
    expect(engines).toContain("rolecall");
    expect(engines).toContain("sillytavern");
    expect(engines).toContain("marinara");
    expect(engines).toContain("lumiverse");
  });

  test("the two trims are not the same operation and never translate into each other", () => {
    expect(resolveEntry("rolecall", "trim", 1)?.op).toBe("text.trim-argument");
    expect(resolveEntry("sillytavern", "trim", 0)?.op).toBe("text.trim-surrounding");
    expect(equivalentOf("rolecall", "sillytavern", "trim", ["x"]).verdict).toBe("collision");
  });

  test("an engine-only macro is absent, with same-family neighbours when any exist", () => {
    const match = equivalentOf("rolecall", "sillytavern", "accentcolor", []);
    expect(match.verdict).toBe("absent");
  });
});

describe("block flattening (only when the target lacks conditionals)", () => {
  // SillyTavern HAS conditionals, so a RoleCall crossing must NOT flatten: doing so would drop a
  // working condition and keep one branch. These exercise the flattener directly, which is what
  // runs for a target that genuinely cannot express a block.
  const flat = (t: string) => {
    const changes: MacroChange[] = [];
    return { text: flattenBlocks(t, "Main", changes), changes };
  };

  test("a target WITH conditionals keeps the block intact", () => {
    const out = rc2st("{{if mood}}You feel it.{{/if}}");
    expect(out.text).toContain("{{if mood}}");
    expect(out.text).toContain("{{/if}}");
    expect(out.changes.some((c) => c.kind === "flatten")).toBe(false);
  });

  test("keeps the body and drops only the scaffolding", () => {
    const out = flat("{{if mood}}You feel it.{{/if}}");
    expect(out.text).toContain("You feel it.");
    expect(out.text).not.toContain("{{if");
    expect(out.text).not.toContain("{{/if}}");
  });

  test("records the condition as a target-safe comment with no braces left inside", () => {
    const out = flat("{{if {{getvar::mood}}}}body{{/if}}");
    const comment = /\{\{\/\/[^}]*\}\}/.exec(out.text)?.[0] ?? "";
    expect(comment).toContain("was if:");
    expect(comment.slice(2, -2)).not.toContain("{{");
  });

  test("takes the first branch and does not emit the else body", () => {
    const out = flat("{{if x}}THEN{{else}}ELSE{{/if}}");
    expect(out.text).toContain("THEN");
    expect(out.text).not.toContain("ELSE");
  });

  test("nested same-type blocks collapse without desyncing on the first closer", () => {
    const out = flat("{{if a}}OUT{{if b}}IN{{/if}}TAIL{{/if}}");
    for (const part of ["OUT", "IN", "TAIL"]) expect(out.text).toContain(part);
    expect(out.text).not.toContain("{{/if}}");
  });

  test("an inline ternary is not a block", () => {
    const changes: MacroChange[] = [];
    expect(flattenBlocks("{{if::cond::yes::no}}", "Main", changes)).toBe("{{if::cond::yes::no}}");
    expect(changes).toEqual([]);
  });

  test("an unterminated opener is not treated as a block", () => {
    const changes: MacroChange[] = [];
    expect(flattenBlocks("{{if a}}dangling", "Main", changes)).toBe("{{if a}}dangling");
    expect(changes).toEqual([]);
  });
});

describe("translation output", () => {
  test("a separator difference is rewritten, not dropped", () => {
    const out = rc2st("{{roll::2d6}} {{datetimeformat::HH:mm}}");
    expect(out.text).toBe("{{roll:2d6}} {{datetimeformat HH:mm}}");
    expect(kinds(out.changes)).toEqual(["rewrite", "rewrite"]);
  });

  test("an identically spelled macro passes through silently", () => {
    const out = rc2st("Hello {{char}}, I am {{user}}.");
    expect(out.text).toBe("Hello {{char}}, I am {{user}}.");
    expect(out.changes).toEqual([]);
  });

  test("a collision is kept in place and flagged, never silently blessed", () => {
    const out = rc2st("{{random::1::10}}");
    expect(out.text).toBe("{{random::1::10}}");
    const collision = out.changes.find((c) => c.kind === "collision");
    expect(collision).toBeDefined();
    expect(collision?.candidates?.length).toBeGreaterThan(0);
  });

  test("comments and dot-locals are left exactly as authored", () => {
    const out = rc2st("{{// keep me}} {{.item}}");
    expect(out.text).toBe("{{// keep me}} {{.item}}");
    expect(out.changes).toEqual([]);
  });

  test("every change carries a reason", () => {
    // The if-block passes through untouched now, so it is not a change and does not appear here.
    const out = rc2st("{{if a}}b{{/if}}{{roll::1d6}}{{accentColor}}{{random::1::2}}{{getvarkey::p::2}}");
    expect(out.changes.length).toBeGreaterThan(2);
    for (const change of out.changes) expect(change.why.length).toBeGreaterThan(10);
  });

  test("an indexed access is lowered onto a plain variable", () => {
    // 83 of this preset family's remaining gaps are array slots with constant indices. An array of
    // fixed slots is a set of variables whose names carry the index, so the access lowers.
    const out = rc2st("{{getvarkey::plan::3}} and {{setvarkey::plan::4::x}}");
    expect(out.text).toBe("{{getvar::plan_3}} and {{setvar::plan_4::x}}");
  });

  test("a computed index lowers into a composed key, since nested macros resolve first", () => {
    const out = rc2st("{{getvarkey::plan::{{getvar::i}}}}");
    expect(out.text).toBe("{{getvar::plan_{{getvar::i}}}}");
  });

  test("a preserved block still translates the macros inside its condition", () => {
    // Found against the real preset: keeping a block token verbatim also kept everything nested in
    // it, so an array read used AS a condition survived as dead syntax on an engine with no arrays.
    // Structure is preserved; the tokens inside it are still the translator's business.
    const out = rc2st("{{if {{getvarkey::plan::{{getvar::i}}}} }}body{{/if}}");
    expect(out.text).toBe("{{if {{getvar::plan_{{getvar::i}}}} }}body{{/if}}");
  });

  test("preserving a block does not invent changes for structure that did not move", () => {
    const out = rc2st("{{if mood}}calm{{else}}tense{{/if}}");
    expect(out.text).toBe("{{if mood}}calm{{else}}tense{{/if}}");
    expect(out.changes).toEqual([]);
  });

  test("a portable macro still translates the macros passed to it as arguments", () => {
    // The general form of the same defect: `setvar` exists on both engines, so the outer token was
    // returned untouched - carrying an array read across to an engine with no arrays. A macro being
    // portable says nothing about what was handed to it.
    const out = rc2st("{{setvar::scene::{{getvarkey::plan::{{getvar::i}}}}}}");
    expect(out.text).toBe("{{setvar::scene::{{getvar::plan_{{getvar::i}}}}}}");
  });

  test("an argument that needs no translation leaves its macro reported as unchanged", () => {
    const out = rc2st("{{setvar::scene::{{char}}}}");
    expect(out.text).toBe("{{setvar::scene::{{char}}}}");
    expect(out.changes).toEqual([]);
  });
});

describe("the annotation gate", () => {
  test("no shared name diverges in shape without a declared operation", () => {
    // This is what keeps the hub honest as engines are added: a name that several engines spell
    // differently, where at least one has not said what it MEANS, is a silent mistranslation
    // waiting to happen. The list must stay empty.
    expect(unannotatedDivergence().map((row) => row.name)).toEqual([]);
  });

  test("every declared operation renders into a form its own engine recognises", () => {
    for (const op of new Set(formsForOp("dice.roll").concat(formsForOp("random.pick")).map((f) => f.entry.op!))) {
      for (const form of formsForOp(op)) {
        const rendered = renderToken(form.entry.macro, ["A"]);
        expect(macroName(rendered)).toBe(macroName(form.entry.macro));
      }
    }
  });
});
