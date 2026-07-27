/**
 * Macro capability questions. The payoff case is the converter one: given real prompt text and a
 * target host, name the macros that die there.
 */
import { describe, expect, test } from "bun:test";
import {
  findMacro,
  isMacroSupported,
  macroName,
  macroSupport,
  scanMacroTokens,
  supportedMacroNames,
  unsupportedIn,
} from "./support";

describe("macroName", () => {
  test("strips separators, args and closers", () => {
    expect(macroName("{{char}}")).toBe("char");
    expect(macroName("{{getvar::mood}}")).toBe("getvar");
    expect(macroName("{{roll:1d6}}")).toBe("roll");
    expect(macroName("{{time_UTC-4}}")).toBe("time_utc");
    expect(macroName("{{time_UTC±#}}")).toBe("time_utc");
    expect(macroName("{{/uppercase}}")).toBe("uppercase");
    expect(macroName('{{banned "text"}}')).toBe("banned");
  });

  test("forms that invoke no name resolve to empty", () => {
    for (const t of ["{{// note}}", "{{.name}}", "{{$globalName}}", "{{\\n}}"]) expect(macroName(t)).toBe("");
  });
});

describe("scanMacroTokens", () => {
  test("pulls every token in source order, keeping duplicates", () => {
    expect(scanMacroTokens("hi {{char}}, {{user}} said {{char}}")).toEqual(["{{char}}", "{{user}}", "{{char}}"]);
  });
  test("no tokens in plain prose", () => {
    expect(scanMacroTokens("just some text")).toEqual([]);
  });

  // Regression: the scanner was `/\{\{[^{}]*\}\}/g`, which cannot cross a brace, so every one of
  // these reported ONLY the inner token and the outer construct was invisible to every check built
  // on it. Under-reporting reads as "nothing dies", the worst direction to be wrong in.
  describe("nested arguments (regression)", () => {
    test("reports the container as well as the macro inside it", () => {
      expect(scanMacroTokens("{{if::{{getvar::x}}::yes::no}}")).toEqual([
        "{{if::{{getvar::x}}::yes::no}}",
        "{{getvar::x}}",
      ]);
    });

    test("the cross-engine trap macro is visible when its argument is a macro", () => {
      // {{random::a::b}} is a list pick on SillyTavern and a numeric range on RoleCall. It is the
      // whole reason this module exists, and it used to vanish the moment an argument nested.
      const tokens = scanMacroTokens("{{random::{{char}}::b}}");
      expect(tokens).toEqual(["{{random::{{char}}::b}}", "{{char}}"]);
      expect(tokens.map(macroName)).toEqual(["random", "char"]);
    });

    test("a block opener carrying a nested condition is not lost", () => {
      expect(scanMacroTokens("{{#if::{{getvar::mood}}}}body{{/if}}")).toEqual([
        "{{#if::{{getvar::mood}}}}",
        "{{getvar::mood}}",
        "{{/if}}",
      ]);
    });

    test("nests more than one level deep", () => {
      expect(scanMacroTokens("{{a::{{b::{{c}}}}}}")).toEqual([
        "{{a::{{b::{{c}}}}}}",
        "{{b::{{c}}}}",
        "{{c}}",
      ]);
    });

    test("siblings after a nested token still scan", () => {
      expect(scanMacroTokens("{{if::{{x}}}} then {{user}}")).toEqual([
        "{{if::{{x}}}}",
        "{{x}}",
        "{{user}}",
      ]);
    });

    test("an unmatched opener degrades to literal text instead of throwing", () => {
      expect(scanMacroTokens("{{char}} then {{oops")).toEqual(["{{char}}"]);
      expect(() => scanMacroTokens("{{{{")).not.toThrow();
    });

    test("a lone brace is ordinary text, not a delimiter", () => {
      expect(scanMacroTokens("{ {{char}} }")).toEqual(["{{char}}"]);
    });
  });
});

describe("supportedMacroNames", () => {
  test("reflects each engine, not one shared list", () => {
    expect(supportedMacroNames("sillytavern").has("pipe")).toBe(true);
    expect(supportedMacroNames("marinara").has("pipe")).toBe(false);
    expect(supportedMacroNames("marinara").has("backstory")).toBe(true);
    expect(supportedMacroNames("sillytavern").has("backstory")).toBe(false);
    expect(supportedMacroNames("rolecall").has("mood")).toBe(true);
    expect(supportedMacroNames("sillytavern").has("mood")).toBe(false);
  });
});

describe("isMacroSupported", () => {
  test("answers per engine", () => {
    expect(isMacroSupported("sillytavern", "{{char}}")).toBe(true);
    expect(isMacroSupported("sillytavern", "{{stat::str}}")).toBe(false);
    expect(isMacroSupported("marinara", "{{appearance}}")).toBe(true);
    expect(isMacroSupported("marinara", "{{pronouns}}")).toBe(false);
  });

  test("never flags comments or shorthands as dead", () => {
    expect(isMacroSupported("sillytavern", "{{// author note}}")).toBe(true);
  });
});

describe("findMacro hands back the engine's REAL form", () => {
  test("same name, different form per engine", () => {
    expect(findMacro("sillytavern", "{{roll:2d6}}")!.macro).toBe("{{roll:1d6}}");
    expect(findMacro("marinara", "{{roll:2d6}}")!.macro).toBe("{{roll:XdY}}");
    expect(findMacro("rolecall", "{{roll:2d6}}")!.macro).toBe("{{roll::NdM}}");
  });

  test("returns null when the engine has no such macro", () => {
    expect(findMacro("sillytavern", "{{inventory}}")).toBeNull();
  });
});

describe("unsupportedIn: the converter case", () => {
  test("an RC-authored block exported to SillyTavern names what dies", () => {
    const authored = "{{char}} feels {{mood}}. Roll {{check::str::15}}. HP {{hp}}. {{getvar::x}}";
    expect(unsupportedIn(authored, "sillytavern")).toEqual(["{{mood}}", "{{check::str::15}}", "{{hp}}"]);
    // ...and the same text is fine on its home engine
    expect(unsupportedIn(authored, "rolecall")).toEqual([]);
  });

  test("dedupes and keeps source order", () => {
    expect(unsupportedIn("{{hp}} {{inventory}} {{hp}}", "sillytavern")).toEqual(["{{hp}}", "{{inventory}}"]);
  });

  test("ST text exported to Marinara flags ST-only plumbing", () => {
    expect(unsupportedIn("{{pipe}} {{isotime}} {{char}}", "marinara")).toEqual(["{{pipe}}"]);
  });

  test("clean text yields nothing", () => {
    expect(unsupportedIn("{{char}} greets {{user}}", "sillytavern")).toEqual([]);
  });
});

describe("macroSupport", () => {
  test("reports every lens carrying the name", () => {
    expect(macroSupport("{{char}}").sort()).toEqual(["full", "lumiverse", "marinara", "rolecall", "sillytavern"]);
    expect(macroSupport("{{hp}}").sort()).toEqual(["full", "rolecall"]);
    expect(macroSupport("{{backstory}}")).toEqual(["marinara"]);
    expect(macroSupport("{{nonsense_xyz}}")).toEqual([]);
  });
});

describe("lumiverse aliases resolve as first-class names", () => {
  test("engine aliases are supported and resolve to the canonical entry", () => {
    expect(isMacroSupported("lumiverse", "{{charName}}")).toBe(true);
    expect(isMacroSupported("lumiverse", "{{ltm}}")).toBe(true);
    expect(isMacroSupported("lumiverse", "{{flushgvar::x}}")).toBe(true);
    expect(findMacro("lumiverse", "{{charName}}")?.macro).toBe("{{char}}");
    expect(unsupportedIn("{{charName}} and {{knowledgeBank}}", "lumiverse")).toEqual([]);
    // and an alias never leaks onto an engine that lacks it
    expect(isMacroSupported("sillytavern", "{{knowledgeBank}}")).toBe(false);
  });
});
