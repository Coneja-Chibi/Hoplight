/**
 * Readiness core: path reads, filled semantics, verdicts, the row line.
 */
import { describe, expect, test } from "bun:test";
import type { CoverageInfo } from "../../app-contract";
import { isFilled, lorebookKeyGap, pathName, readBodyPath, readiness, readinessLine } from "./readiness-core";

const cov = (carries: string[]): CoverageInfo => ({ id: "x", label: "X", carries });

describe("isFilled", () => {
  test("real answers count; absence and blanks do not; 0 is a real answer", () => {
    expect(isFilled("hi")).toBe(true);
    expect(isFilled("  ")).toBe(false);
    expect(isFilled(0)).toBe(true);
    expect(isFilled(false)).toBe(false);
    expect(isFilled([])).toBe(false);
    expect(isFilled(["k"])).toBe(true);
    expect(isFilled({ a: "" })).toBe(false);
    expect(isFilled({ a: "x" })).toBe(true);
    expect(isFilled(undefined)).toBe(false);
    expect(isFilled(null)).toBe(false);
  });
});

describe("readiness", () => {
  const body = {
    identity: { name: "Adrian", description: "a detective" },
    persona: { personality: "curious", scenario: "" },
    prompts: {},
  };

  test("splits carried paths into filled and empty; names the empties humanly", () => {
    const r = readiness(body, cov(["identity.name", "persona.personality", "persona.scenario", "prompts.systemPrompt"]));
    expect(r.filled).toEqual(["identity.name", "persona.personality"]);
    expect(r.empty).toEqual(["persona.scenario", "prompts.systemPrompt"]);
    expect(r.emptyNames).toEqual(["scenario", "system prompt"]);
    expect(r.verdict).toBe("empties");
  });

  test("all filled reads ready; no coverage reads unknown, never fake green", () => {
    expect(readiness(body, cov(["identity.name"])).verdict).toBe("ready");
    expect(readiness(body, undefined).verdict).toBe("unknown");
    expect(readiness(body, cov([])).verdict).toBe("unknown");
  });

  test("readBodyPath walks safely through missing hops", () => {
    expect(readBodyPath(body, "identity.name")).toBe("Adrian");
    expect(readBodyPath(body, "media.portrait.ref")).toBeUndefined();
  });
});

describe("readinessLine", () => {
  test("counts, names up to three empties, folds the rest", () => {
    const r = readiness({}, cov(["a.one", "a.two", "a.three", "a.four", "a.five"]));
    expect(readinessLine(r)).toBe("0 of 5 filled - empty: one, two, three, +2 more");
    expect(readinessLine(readiness({ a: { one: "x" } }, cov(["a.one"])))).toBe(
      "1 of 1 filled - everything carried is set",
    );
    expect(readinessLine(readiness({}, undefined))).toBe("no coverage claims for this platform");
  });

  test("pathName splits camelCase into words", () => {
    expect(pathName("prompts.postHistoryInstructions")).toBe("post history instructions");
  });
});

describe("lorebookKeyGap", () => {
  test("counts entries that can never fire; constant entries are fine keyless", () => {
    const body = {
      entries: [
        { triggers: [{ keyword: "x" }] },
        { triggers: [], constant: true },
        { triggers: [] },
        { triggers: [] },
      ],
    };
    expect(lorebookKeyGap(body)).toEqual({ total: 4, keyless: 2 });
    expect(lorebookKeyGap({})).toEqual({ total: 0, keyless: 0 });
  });
});
