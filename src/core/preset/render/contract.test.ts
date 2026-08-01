/**
 * Contract for reading a renderer's reply.
 *
 * The distinction these tests defend: "the engine says nothing was unresolved" and "the renderer did not
 * tell us" must never collapse into the same answer. That collapse is the only way this feature can make
 * things worse than having no verification at all, because a confident false clean is worse than a
 * missing check somebody can see is missing.
 */
import { describe, expect, test } from "bun:test";
import { parseRenderReply, unresolvedCount, type RenderedPreset } from "./contract";

const engine = { name: "sillytavern", version: "1.18.0", source: "bundled" };
const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ prompt: "assembled", unresolved: [], warnings: [], engine, ...over });

const ok = (out: ReturnType<typeof parseRenderReply>): RenderedPreset => {
  if (!out.ok) throw new Error(`expected success, got ${out.reason}: ${out.detail}`);
  return out;
};

describe("a well-formed reply", () => {
  test("carries the prompt, the stamp and an empty unresolved list", () => {
    const r = ok(parseRenderReply(reply()));
    expect(r.prompt).toBe("assembled");
    expect(r.engine).toEqual(engine);
    expect(r.unresolved).toEqual([]);
    expect(unresolvedCount(r)).toBe(0);
  });

  test("reads unresolved macros and totals their occurrences", () => {
    const r = ok(parseRenderReply(reply({
      unresolved: [{ token: "{{choice::x}}", count: 3 }, { token: "{{upper::y}}", count: 1, where: "prompts[2]" }],
    })));
    expect(unresolvedCount(r)).toBe(4);
    expect(r.unresolved[1]?.where).toBe("prompts[2]");
  });

  test("a missing count means one occurrence, not zero", () => {
    // Zero would read as "resolved", which is the opposite of what the renderer just reported.
    expect(unresolvedCount(ok(parseRenderReply(reply({ unresolved: [{ token: "{{x}}" }] }))))).toBe(1);
  });

  test("tolerates a renderer that logged before answering", () => {
    const r = ok(parseRenderReply(`loading engine...\nregistered 87 macros\n${reply()}`));
    expect(r.prompt).toBe("assembled");
  });

  test("non-string warnings are dropped rather than failing the whole reply", () => {
    const r = ok(parseRenderReply(reply({ warnings: ["real", 7, null, "also real"] })));
    expect(r.warnings).toEqual(["real", "also real"]);
  });
});

describe("refusals, never throws", () => {
  const bad = (input: string) => {
    const out = parseRenderReply(input);
    if (out.ok) throw new Error("expected a refusal");
    return out;
  };

  test("empty output", () => {
    expect(bad("").reason).toBe("bad-output");
    expect(bad("   \n ").detail).toMatch(/no output/);
  });

  test("not JSON, and the detail shows what was seen", () => {
    const r = bad("Error: cannot find module 'chevrotain'");
    expect(r.reason).toBe("bad-output");
    expect(r.detail).toContain("chevrotain");
  });

  test("JSON that is not an object", () => {
    expect(bad("[1,2,3]").reason).toBe("bad-output");
    expect(bad('"a string"').reason).toBe("bad-output");
  });

  test("no assembled prompt", () => {
    expect(bad(JSON.stringify({ unresolved: [], engine })).detail).toMatch(/assembled prompt/);
  });

  test("MISSING unresolved is refused, never read as clean", () => {
    // The whole point. A renderer that forgot the field must not be mistaken for one reporting zero.
    const r = bad(JSON.stringify({ prompt: "p", engine }));
    expect(r.reason).toBe("bad-output");
    expect(r.detail).toMatch(/unresolved/);
  });

  test("a malformed entry in unresolved fails the reply rather than being skipped", () => {
    // Silently dropping an entry would under-report exactly the thing being counted.
    expect(bad(reply({ unresolved: [{ token: "{{a}}" }, { nope: 1 }] })).detail).toMatch(/unresolved/);
  });

  test("an unstamped engine is refused", () => {
    // A reply with no version cannot say which build it modelled, and a vendored engine in this repo has
    // already drifted from the install beside it.
    expect(bad(JSON.stringify({ prompt: "p", unresolved: [] })).detail).toMatch(/engine and version/);
    expect(bad(reply({ engine: { name: "sillytavern", source: "bundled" } })).detail).toMatch(/version/);
    expect(bad(reply({ engine: { name: "st", version: "1", source: "" } })).reason).toBe("bad-output");
  });
});
