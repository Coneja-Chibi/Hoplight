/**
 * Removing an inline cleanup macro by repairing what made the mess.
 *
 * The tempting conversion - turn the macro into a regex script - is impossible, not merely hard:
 * scripts run over chat messages and world info, never over preset prompt content, so no arrangement
 * of them can clean a variable read inside a prompt. What IS fixable is the reason the cleanup
 * exists, and only for shapes that can be recognised without running an authored regex. Everything
 * else must come back as unfixed with a reason, because a wrong guess here silently changes what a
 * preset renders.
 */
import { describe, expect, test } from "bun:test";
import { fixProducers, stripsSeparator } from "./fix-producer";

const preset = (content: string): unknown => ({ prompts: [{ id: "b", name: "Pool", content }] });
const contentOf = (body: unknown): string =>
  ((body as { prompts: { content: string }[] }).prompts[0]!).content;

const JOINED = [
  "{{setvar::pool::}}",
  "{{addvar::pool::, ALPHA}}",
  "{{addvar::pool::, BETA}}",
  "{{setvar::pool::{{regex::{{getvar::pool}}::^,\\s*::}}}}",
].join("");

describe("a list joined with a leading separator", () => {
  const out = fixProducers(preset(JOINED));

  test("every append is guarded on whether the variable already holds something", () => {
    expect(contentOf(out.body)).toContain(
      "{{if {{getvar::pool}}}}{{addvar::pool::, ALPHA}}{{else}}{{setvar::pool::ALPHA}}{{/if}}",
    );
    expect(contentOf(out.body)).toContain(
      "{{if {{getvar::pool}}}}{{addvar::pool::, BETA}}{{else}}{{setvar::pool::BETA}}{{/if}}",
    );
  });

  test("the cleanup is deleted, not translated, because nothing is left to clean", () => {
    expect(contentOf(out.body)).not.toContain("{{regex::");
    // The assignment that existed only to hold it goes with it. The author's own opening reset is
    // NOT that assignment and must survive, so exactly one empty write remains.
    expect([...contentOf(out.body).matchAll(/\{\{setvar::pool::\}\}/g)]).toHaveLength(1);
    expect(contentOf(out.body).startsWith("{{setvar::pool::}}")).toBe(true);
  });

  test("the repair is reported with the separator it found", () => {
    expect(out.fixes).toEqual([{
      variable: "pool",
      separator: ", ",
      cleanup: "{{regex::{{getvar::pool}}::^,\\s*::}}",
      guarded: 2,
      where: "Pool",
    }]);
    expect(out.unfixed).toEqual([]);
  });

  test("conditional blocks stay balanced", () => {
    // An unbalanced rewrite would break every block after it, which is far worse than not fixing.
    const text = contentOf(out.body);
    const opens = [...text.matchAll(/\{\{if /g)].length;
    const closes = [...text.matchAll(/\{\{\/if\}\}/g)].length;
    expect(opens).toBe(closes);
  });
});

describe("scope travels with the variable", () => {
  // SillyTavern keeps chat-local and global variables in separate stores. Guarding a global append
  // with a chat-local read would test a variable that is always empty, so every append would take
  // the first-item branch and the list would never join.
  const GLOBAL = [
    "{{addglobalvar::pool::, ALPHA}}",
    "{{addglobalvar::pool::, BETA}}",
    "{{setglobalvar::pool::{{regex::{{getglobalvar::pool}}::^,\\s*::}}}}",
  ].join("");

  test("a global list is repaired with global reads and writes throughout", () => {
    const out = fixProducers(preset(GLOBAL));
    expect(out.fixes).toHaveLength(1);
    expect(contentOf(out.body)).toContain(
      "{{if {{getglobalvar::pool}}}}{{addglobalvar::pool::, ALPHA}}{{else}}{{setglobalvar::pool::ALPHA}}{{/if}}",
    );
    expect(contentOf(out.body)).not.toContain("{{getvar::pool}}");
  });

  test("a global cleanup is not repaired from chat-local appends", () => {
    // Same name, different store: these appends are not the producer of that value.
    const mixed = "{{addvar::pool::, ALPHA}}{{setglobalvar::pool::{{regex::{{getglobalvar::pool}}::^,\\s*::}}}}";
    const out = fixProducers(preset(mixed));
    expect(out.fixes).toEqual([]);
    expect(out.unfixed[0]?.reason).toContain("producer is elsewhere");
  });
});

describe("what is refused rather than guessed", () => {
  test("a cleanup that rewrites rather than strips is left alone", () => {
    const out = fixProducers(preset("{{regex::{{getvar::pool}}::^,\\s*::; }}"));
    expect(out.fixes).toEqual([]);
    expect(out.unfixed[0]?.reason).toContain("rewrite");
  });

  test("a cleanup over something other than a plain variable read is left alone", () => {
    const out = fixProducers(preset("{{regex::{{char}} and {{user}}::^,::}}"));
    expect(out.fixes).toEqual([]);
    expect(out.unfixed[0]?.reason).toContain("no single producer");
  });

  test("a producer in another block is reported, not reached across for", () => {
    // Guarding it would need to know block order, which this function has no business assuming.
    const out = fixProducers(preset("{{setvar::pool::{{regex::{{getvar::pool}}::^,\\s*::}}}}"));
    expect(out.fixes).toEqual([]);
    expect(out.unfixed[0]?.reason).toContain("producer is elsewhere");
  });

  test("a pattern that does not plainly strip the shared separator is left alone", () => {
    const out = fixProducers(preset(
      "{{addvar::pool::, A}}{{addvar::pool::, B}}{{setvar::pool::{{regex::{{getvar::pool}}::^x+::}}}}",
    ));
    expect(out.fixes).toEqual([]);
    expect(out.unfixed[0]?.reason).toContain("does not plainly strip");
  });
});

describe("pattern recognition never runs the pattern", () => {
  test("plain separator strips are recognised", () => {
    expect(stripsSeparator("^,\\s*", ", ")).toBe(true);
    expect(stripsSeparator("^,\\s+", ", ")).toBe(true);
    expect(stripsSeparator("^;", ";")).toBe(true);
  });

  test("anything needing real regex semantics is refused", () => {
    expect(stripsSeparator("^(a|b)", ", ")).toBe(false);
    expect(stripsSeparator("^[,;]\\s*", ", ")).toBe(false);
    expect(stripsSeparator(",\\s*", ", ")).toBe(false); // unanchored: not a prefix strip
  });

  test("a pattern that strips a different separator is refused", () => {
    expect(stripsSeparator("^;\\s*", ", ")).toBe(false);
  });
});

test("a body with no prompts is returned unchanged", () => {
  expect(fixProducers({}).fixes).toEqual([]);
  expect(fixProducers(null).body).toBeNull();
});
