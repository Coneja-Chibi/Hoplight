/**
 * The reading half, checked against the catalogs it reads.
 *
 * The assertions that matter here are the ones about CONFIDENCE. A macro lab is a place people come
 * to find out whether something works, so every way this file could overstate what it knows is worth
 * an assertion: a comment printed as a supported macro, a name present on two engines printed as
 * "travels fine", a nested lookup lost inside its container.
 */
import { describe, expect, it } from "bun:test";
import { buildResolveAsk, readMacros, travelFor, VERDICT_LABEL } from "./lab-core";

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
