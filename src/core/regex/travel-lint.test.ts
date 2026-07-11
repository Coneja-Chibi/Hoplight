/**
 * travelLint: one case per support-table row, per profile, plus the engine-truth boundary cases
 * (escaped-backslash vs real case token, unparseable find, look-ahead vs look-behind). Mirrors the
 * survey-grounded table in platform-fields.ts (REGEX-JEWEL-PLAN.md R2X, QOL 27).
 */
import { describe, expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import { REGEX_WRITE_FOR_PROFILES, type RegexWriteForProfile } from "./capabilities";
import { travelLint } from "./travel-lint";

const rule = (over: Partial<RegexRule>): RegexRule => ({
  id: "r1",
  label: "t",
  find: "cat",
  flags: "g",
  replace: "dog",
  phases: ["output"],
  enabled: true,
  sortOrder: 0,
  ...over,
});

const NON_FULL = REGEX_WRITE_FOR_PROFILES.filter((p) => p !== "full");

describe("travelLint - clean rule and the home lens", () => {
  test("a plain rule (no extensions) returns [] for every profile", () => {
    for (const p of REGEX_WRITE_FOR_PROFILES) {
      expect(travelLint(rule({}), p)).toEqual([]);
    }
  });

  test("full (Vaude) is home: every feature-bearing rule still returns []", () => {
    const loud = rule({
      find: "(?<=a)b",
      flags: "gv<cbs>",
      replace: "{{match}}\\U$1\\E",
    });
    expect(travelLint(loud, "full")).toEqual([]);
  });
});

describe("travelLint - {{match}} (ST + RC run it; others print it literally)", () => {
  const r = rule({ replace: "before {{match}} after" });

  test("supported on full/sillytavern/rolecall -> no note", () => {
    for (const p of ["full", "sillytavern", "rolecall"] as const) {
      expect(travelLint(r, p)).toEqual([]);
    }
  });

  test("unsupported on risu/lumiverse/marinara -> one note with the exact span", () => {
    for (const p of ["risu", "lumiverse", "marinara"] as const) {
      const notes = travelLint(r, p);
      expect(notes.length).toBe(1);
      const note = notes[0]!;
      expect(note.feature).toBe("match-token");
      expect(note.field).toBe("replace");
      expect(note.severity).toBe("unsupported");
      expect(r.replace.slice(note.span.start, note.span.end)).toBe("{{match}}");
    }
  });

  test("{{match}} sugar is case-insensitive, like the engine", () => {
    const notes = travelLint(rule({ replace: "x {{MATCH}} y" }), "risu");
    expect(notes.length).toBe(1);
    expect(notes[0]!.feature).toBe("match-token");
  });
});

describe("travelLint - case transforms (vaud-engine only)", () => {
  test("full -> [], every other lens flags each \\case token", () => {
    const r = rule({ replace: "\\U$1\\E" });
    expect(travelLint(r, "full")).toEqual([]);
    for (const p of NON_FULL) {
      const notes = travelLint(r, p).filter((n) => n.feature === "case-transform");
      expect(notes.length).toBe(2); // \U and \E
      expect(r.replace.slice(notes[0]!.span.start, notes[0]!.span.end)).toBe("\\U");
    }
  });

  test("a one-shot \\u is flagged too", () => {
    const notes = travelLint(rule({ replace: "\\u$1" }), "sillytavern");
    expect(notes.map((n) => n.feature)).toEqual(["case-transform"]);
    expect(notes[0]!.span).toEqual({ start: 0, end: 2 });
  });

  test('ENGINE TRUTH: an escaped backslash "\\\\U" is a literal U, NOT a case token', () => {
    // Source string is backslash, backslash, U -> the engine emits a literal "\" then "U".
    const notes = travelLint(rule({ replace: "\\\\U" }), "sillytavern");
    expect(notes).toEqual([]);
  });

  test("a lone trailing backslash produces no note", () => {
    expect(travelLint(rule({ replace: "end\\" }), "marinara")).toEqual([]);
  });
});

describe("travelLint - <cbs> flag tokens (Risu only)", () => {
  const r = rule({ flags: "gu<cbs>", useFlags: true });

  test("risu runs it -> no cbs note", () => {
    expect(travelLint(r, "risu").filter((n) => n.feature === "cbs-flag-tokens")).toEqual([]);
  });

  test("every other lens flags the <cbs> token span in flags", () => {
    for (const p of ["sillytavern", "rolecall", "lumiverse", "marinara"] as const) {
      const notes = travelLint(r, p).filter((n) => n.feature === "cbs-flag-tokens");
      expect(notes.length).toBe(1);
      const note = notes[0]!;
      expect(note.field).toBe("flags");
      expect(r.flags.slice(note.span.start, note.span.end)).toBe("<cbs>");
    }
  });

  test("useFlags:false still flags it - the token still travels on the wire", () => {
    const off = rule({ flags: "gu<cbs>", useFlags: false });
    const notes = travelLint(off, "sillytavern").filter((n) => n.feature === "cbs-flag-tokens");
    expect(notes.length).toBe(1);
  });
});

describe("travelLint - v flag (host-age risk)", () => {
  const r = rule({ flags: "gv" });

  test("full -> []", () => {
    expect(travelLint(r, "full")).toEqual([]);
  });

  test("every other lens flags v as host-age with the right span", () => {
    for (const p of NON_FULL) {
      const notes = travelLint(r, p).filter((n) => n.feature === "v-flag");
      expect(notes.length).toBe(1);
      const note = notes[0]!;
      expect(note.severity).toBe("host-age");
      expect(note.field).toBe("flags");
      expect(note.span).toEqual({ start: 1, end: 2 });
    }
  });

  test("a v INSIDE a <...> token is not mistaken for the v flag", () => {
    const notes = travelLint(rule({ flags: "gu<verbose>" }), "sillytavern");
    expect(notes.filter((n) => n.feature === "v-flag")).toEqual([]);
  });
});

describe("travelLint - look-behind (host-age risk)", () => {
  test("full -> []", () => {
    expect(travelLint(rule({ find: "(?<=foo)bar" }), "full")).toEqual([]);
  });

  test("positive look-behind flagged on every other lens with its full span", () => {
    const r = rule({ find: "(?<=foo)bar" });
    for (const p of NON_FULL) {
      const notes = travelLint(r, p).filter((n) => n.feature === "lookbehind");
      expect(notes.length).toBe(1);
      const note = notes[0]!;
      expect(note.severity).toBe("host-age");
      expect(note.field).toBe("find");
      expect(r.find.slice(note.span.start, note.span.end)).toBe("(?<=foo)");
    }
  });

  test("negative look-behind is flagged; a nested one is found too", () => {
    const notes = travelLint(rule({ find: "a(x(?<!y)z)b" }), "risu");
    const lb = notes.filter((n) => n.feature === "lookbehind");
    expect(lb.length).toBe(1);
    expect(rule({ find: "a(x(?<!y)z)b" }).find.slice(lb[0]!.span.start, lb[0]!.span.end)).toBe("(?<!y)");
  });

  test("look-AHEAD is NOT a look-behind - no note", () => {
    const notes = travelLint(rule({ find: "(?=foo)bar" }), "sillytavern");
    expect(notes.filter((n) => n.feature === "lookbehind")).toEqual([]);
  });

  test("a named group (?<name>...) is not a look-behind", () => {
    const notes = travelLint(rule({ find: "(?<word>\\w+)" }), "sillytavern");
    expect(notes.filter((n) => n.feature === "lookbehind")).toEqual([]);
  });
});

describe("travelLint - tolerance and composition", () => {
  test("an unparseable find yields no AST notes, but replace/flags are still linted", () => {
    // "(" never closes: parseRegex errors, so no look-behind walk, but {{match}} still fires.
    const notes = travelLint(rule({ find: "(", replace: "{{match}}" }), "risu");
    expect(notes.map((n) => n.feature)).toEqual(["match-token"]);
  });

  test("a rule using everything at once reports every applicable feature (ST runs {{match}}, so no match-token note)", () => {
    const loud = rule({ find: "(?<=a)b", flags: "gv<cbs>", replace: "{{match}}\\U" });
    const features = travelLint(loud, "sillytavern")
      .map((n) => n.feature)
      .sort();
    expect(features).toEqual(["case-transform", "cbs-flag-tokens", "lookbehind", "v-flag"]);
  });

  test("on risu the same rule flags match-token (risu lacks {{match}}) but not <cbs>", () => {
    const loud = rule({ find: "(?<=a)b", flags: "gv<cbs>", replace: "{{match}}\\U" });
    const features = travelLint(loud, "risu")
      .map((n) => n.feature)
      .sort();
    expect(features).toEqual(["case-transform", "lookbehind", "match-token", "v-flag"]);
  });
});
