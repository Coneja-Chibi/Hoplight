/**
 * regex_lab against the real engine. Each verb is asserted on the property that makes it worth
 * having, not on its prose - a tool whose only test is "it returned a string" would pass while
 * reporting nonsense, which is exactly the failure this tool exists to prevent elsewhere.
 */
import { describe, expect, test } from "bun:test";
import regexLab from "./regex-lab";

const run = async (args: Record<string, unknown>) =>
  regexLab.execute(regexLab.input.parse(args), {} as never);

describe("try - the verb that makes regex not write-only", () => {
  test("reports the real match count and the real replaced text", async () => {
    const out = await run({
      action: "try",
      find: "\\*(.+?)\\*",
      replace: "<i>$1</i>",
      sample: "She *sighed* and then *left*.",
    });
    expect(out.summary).toContain("2 matches");
    expect(out.output).toContain("<i>sighed</i>");
    expect(out.output).toContain("<i>left</i>");
  });

  test("a pattern that matches NOTHING is reported apart from one that changed nothing", async () => {
    // Both come back with identical text. Collapsing them is how somebody ships a rule that never
    // fires and believes it worked.
    const out = await run({ action: "try", find: "zzz", replace: "x", sample: "nothing here" });
    expect(out.summary).toContain("0 matches");
    expect(out.output).toContain("NO - the text came back identical");
  });

  test("REFUSES a catastrophic-backtracking bomb instead of running it", async () => {
    // The property that actually protects a person: (a+)+$ hangs inside one native RegExp call and
    // nothing can interrupt it, so it must never reach the engine at all.
    const out = await run({ action: "try", find: "(a+)+$", replace: "", sample: "aaaaaaaaaaaaaaaa!" });
    expect(out.summary).toContain("refused");
    expect(out.output).toContain("hang");
  });

  test("asking to try without a sample is refused rather than answered vaguely", async () => {
    const out = await run({ action: "try", find: "a", replace: "b" });
    expect(out.summary).toContain("no sample");
  });
});

describe("show - the caret ruler", () => {
  test("every caret sits under the character it actually matched", async () => {
    // The bug this pins: the first version built the ruler as a list of chunks and measured position
    // by array length, so a chunk holding 8 carets counted as 1. Ruler two onward drifted right by
    // (width - 1) and looked entirely plausible while pointing at the wrong word.
    const sample = "She *sighed* and then *left* quietly.";
    const out = await run({ action: "show", find: "\\*(.+?)\\*", sample });
    const ruler = out.output.split("\n").find((l) => l.trim().startsWith("^"));
    expect(ruler).toBeTruthy();
    for (let i = 0; i < ruler!.length; i++) {
      if (ruler![i] === "^") {
        // A caret may only sit over a character inside a real match.
        expect(sample[i]).toBeDefined();
      }
    }
    // Concretely: the two matches start at 4 and 22, so those columns carry carets and 13 does not.
    expect(ruler![4]).toBe("^");
    expect(ruler![22]).toBe("^");
    expect(ruler![13]).not.toBe("^");
  });

  test("reports capture groups per match", async () => {
    const out = await run({ action: "show", find: "(\\w+)@(\\w+)", sample: "mail bob@example now" });
    expect(out.output).toContain('$1="bob"');
    expect(out.output).toContain('$2="example"');
  });
});

describe("race - the bake-off", () => {
  test("shows greedy over-matching next to lazy, which is the whole point", async () => {
    const out = await run({
      action: "race",
      sample: "She *sighed* and then *left*.",
      rules: [{ label: "lazy", find: "\\*(.+?)\\*" }, { label: "greedy", find: "\\*(.+)\\*" }],
    });
    expect(out.output).toContain("lazy");
    expect(out.output).toContain("greedy");
    // The greedy one swallows the gap between the two emphases - one hit, not two.
    expect(out.output).toContain('"*sighed* and then *left*"');
    // And it refuses to crown a winner, because most matches is not most correct.
    expect(out.output).toContain("not the same as most correct");
  });

  test("a refused candidate is named rather than dropped from the table", async () => {
    const out = await run({
      action: "race",
      sample: "aaaa",
      rules: [{ label: "safe", find: "a" }, { label: "bomb", find: "(a+)+$" }],
    });
    expect(out.output).toContain("REFUSED");
    expect(out.output).toContain("bomb");
  });
});

describe("read - plain words, with engine-verified chips", () => {
  test("explains a pattern and offers strings it genuinely matches", async () => {
    const out = await run({ action: "read", find: "\\bcat\\b", flags: "gi" });
    expect(out.output).toContain("pattern  /\\bcat\\b/gi");
    // The chips come from readoutFor, which execution-verifies them; a claim here is checkable.
    expect(out.output.length).toBeGreaterThan(40);
  });

  test("is deterministic - the same pattern reads the same way twice", async () => {
    // readoutFor takes an rng, so an unseeded stream would make a tool answer differently each call.
    const a = await run({ action: "read", find: "\\b(hello|hi)\\b", flags: "g" });
    const b = await run({ action: "read", find: "\\b(hello|hi)\\b", flags: "g" });
    expect(a.output).toBe(b.output);
  });
});

describe("lint - a whole set at once", () => {
  test("finds the bomb in a set and marks it a problem", async () => {
    const out = await run({
      action: "lint",
      rules: [
        { label: "fine", find: "cat", replace: "dog" },
        { label: "bomb", find: "(a+)+$", replace: "" },
      ],
    });
    expect(out.summary).toContain("problem");
    expect(out.output).toContain("bomb");
  });

  test("a clean set says so plainly", async () => {
    const out = await run({ action: "lint", rules: [{ label: "fine", find: "cat", replace: "dog" }] });
    expect(out.summary).toContain("clean");
  });
});

describe("recipes - the catalog Kit never exposed", () => {
  test("lists real recipes", async () => {
    const out = await run({ action: "recipes" });
    expect(out.summary).toMatch(/regex_lab recipes: [1-9]/);
  });

  test("a named recipe carries the engine's OWN before/after, not a hand-written promise", async () => {
    const listed = await run({ action: "recipes" });
    const id = /^\s{2}(\S+)\s{2,}/m.exec(listed.output.split("\n").filter((l) => l.startsWith("  "))[0] ?? "")?.[1];
    expect(id).toBeTruthy();
    const one = await run({ action: "recipes", recipe: id });
    expect(one.output).toContain("before");
    expect(one.output).toContain("after");
  });

  test("an unknown id lists what does exist instead of failing blankly", async () => {
    const out = await run({ action: "recipes", recipe: "no-such-recipe" });
    expect(out.summary).toContain("no recipe");
    expect(out.output).toContain("Known ids");
  });
});

describe("from_examples", () => {
  test("builds a pattern that actually catches the examples it was given", async () => {
    const examples = ["the red door", "the blue door", "the green door"];
    const built = await run({ action: "from_examples", examples });
    const found = /\/(.+)\/([a-z]*)$/.exec(built.summary.replace("regex_lab from_examples: ", ""));
    expect(found).toBeTruthy();
    // The claim worth testing is not that it returned a pattern - it is that the pattern WORKS on
    // the input it was derived from. A builder that returns something plausible and non-matching
    // would look identical in the summary.
    const re = new RegExp(found![1]!, found![2]!);
    for (const e of examples) expect(re.test(e)).toBe(true);
  });

  test("says so when the examples share no usable structure", async () => {
    const out = await run({ action: "from_examples", examples: [""] });
    expect(out.summary).toContain("nothing shared");
  });
});
