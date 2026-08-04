/**
 * The regex workbench: try it, read it, lint it, or start from a recipe.
 *
 * WHY THIS EXISTS. `src/core/regex/` is one of the most developed corners of this repo - an apply
 * engine with per-match tracing, a validator that refuses catastrophic backtracking, a plain-words
 * readout with execution-verified example chips, a set linter, an example-driven builder, and a
 * curated recipe catalog whose before/after pairs are engine-computed rather than written by hand.
 * All pure, all tested. Kit exposed exactly one regex tool: `regex_create`. So a model asked to
 * change a rule had the hardest part of this product sitting right there, unreachable, and did the
 * one thing that is actually dangerous here - wrote a pattern from memory and hoped.
 *
 * Regex is the only content in the studio that is WRITE-ONLY WITHOUT A PREVIEW. A lorebook entry
 * that is wrong reads wrong. A bad pattern looks fine and silently eats text, or hangs the engine on
 * one unlucky message. `try` is therefore the load-bearing verb, not a convenience: it runs the real
 * engine over real text and reports what actually changed - including the case that looks like
 * success from the outside, where the pattern matched nothing and the text came back untouched.
 *
 * Everything here is a READ. No draft, no write, no storage. Saving and attaching stay with the
 * create/apply tools that already own that boundary.
 */
import { z } from "zod";
import {
  applyRules,
  buildFromExamples,
  inspectSet,
  readoutFor,
  TEMPLATE_CATALOG,
  validateRule,
} from "../../core/regex";
import type { RegexRule } from "../../entities/regex/schema";
import type { HarnessTool, ToolResult } from "./tool";

const input = z.strictObject({
  action: z.enum(["try", "show", "read", "lint", "recipes", "from_examples", "race"]).default("read"),
  find: z.string().max(10_000).optional().describe("the bare pattern, no delimiters"),
  flags: z.string().max(40).default("g").describe("verbatim flags, e.g. g / gi / gm"),
  replace: z.string().max(10_000).default("").describe("replacement; $1 and friends work"),
  sample: z.string().max(20_000).optional()
    .describe("for try: the text to run it against. Use real chat text, not a toy string."),
  examples: z.array(z.string().max(500)).max(40).optional()
    .describe("for from_examples: phrases the pattern should catch"),
  rules: z.array(z.strictObject({
    label: z.string().max(200).default(""),
    find: z.string().max(10_000),
    flags: z.string().max(40).default("g"),
    replace: z.string().max(10_000).default(""),
    enabled: z.boolean().default(true),
  })).max(100).optional().describe("for lint: a whole set checked at once"),
  recipe: z.string().max(80).optional().describe("for recipes: an id, to get just that one"),
});

type Input = z.infer<typeof input>;

/** Fill a partial rule out to the canonical shape the engine expects. */
const asRule = (
  r: { label?: string; find: string; flags?: string; replace?: string; enabled?: boolean },
  index: number,
): RegexRule => ({
  id: `lab-${index}`,
  label: r.label || `rule ${index + 1}`,
  find: r.find,
  flags: r.flags ?? "g",
  replace: r.replace ?? "",
  phases: ["display"],
  enabled: r.enabled ?? true,
  sortOrder: index,
});

/** A seeded stream, because readoutFor takes an rng and a tool must not vary run to run. */
const steadyRng = (): (() => number) => {
  let seed = 0x2f6e2b1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
};

const bar = (n: number, cap = 24): string => "#".repeat(Math.min(cap, n));
const say = (summary: string, output: string): ToolResult => ({ summary, output });

const tryIt = (args: Input): ToolResult => {
  if (!args.find) return say("regex_lab try: no pattern", "Pass `find`.");
  if (args.sample === undefined) {
    return say(
      "regex_lab try: no sample",
      "Pass `sample`. The whole point of this verb is running the pattern over real text.",
    );
  }
  const rule = asRule({ find: args.find, flags: args.flags, replace: args.replace }, 0);
  // Validate BEFORE running. apply.ts never executes a pattern the validator refuses, because a
  // bomb like (a+)+$ hangs inside one native RegExp call with nothing able to interrupt it.
  const verdict = validateRule(rule);
  if (!verdict.ok) {
    return say(
      `regex_lab try: refused - ${verdict.error ?? "invalid"}`,
      [
        `The engine will not run this pattern.`,
        ``,
        `  ${verdict.error ?? "invalid"}`,
        `  complexity ${verdict.complexity}`,
        ``,
        `This is the catastrophic-backtracking guard, not a style opinion: a pattern shaped like`,
        `this can hang the engine on a single unlucky message, with no way to cancel it.`,
      ].join("\n"),
    );
  }

  const result = applyRules(args.sample, [rule], { phase: "display" });
  const trace = result.traces[0];
  const hits = trace?.matchCount ?? 0;
  const changed = result.text !== args.sample;
  const lines = [
    `pattern  /${args.find}/${args.flags}`,
    `replace  ${args.replace === "" ? "(delete the match)" : args.replace}`,
    ``,
    `matches  ${hits} ${bar(hits)}`,
    `changed  ${changed ? "yes" : "NO - the text came back identical"}`,
    `time     ${trace ? `${trace.elapsedMs.toFixed(1)}ms` : "-"}`,
  ];
  if (trace?.skipReason) lines.push(`skipped  ${trace.skipReason}`);
  lines.push(``, `--- before ---`, args.sample.slice(0, 1000));
  lines.push(``, `--- after ----`, result.text.slice(0, 1000));

  if (hits > 0 && trace?.matches) {
    lines.push(``, `--- what it caught ---`);
    for (const m of trace.matches.slice(0, 12)) {
      lines.push(`  ${JSON.stringify(args.sample!.slice(m.whole.start, m.whole.end))}`);
    }
  }
  if (!changed) {
    lines.push(
      ``,
      `Nothing changed. Either it matched nothing, or it matched and the replacement is identical`,
      `to what it replaced. Both look like success from outside, which is why they are reported apart.`,
    );
  }
  return say(`regex_lab try: ${hits} match${hits === 1 ? "" : "es"}`, lines.join("\n"));
};

/**
 * The compiler-error view of a pattern: the sample with a caret ruler under it marking every match,
 * numbered, and each capture group shown beneath.
 *
 * `try` answers "did it work". This answers "WHERE, exactly" - the question you actually have when a
 * pattern catches one word too many. Reading spans off a list of quoted strings makes you rebuild the
 * position in your head; a ruler puts it under the character it hit.
 */
const show = (args: Input): ToolResult => {
  if (!args.find) return say("regex_lab show: no pattern", "Pass `find`.");
  const sample = args.sample;
  if (sample === undefined) return say("regex_lab show: no sample", "Pass `sample`.");
  const rule = asRule({ find: args.find, flags: args.flags, replace: args.replace }, 0);
  const verdict = validateRule(rule);
  if (!verdict.ok) {
    return say(`regex_lab show: refused - ${verdict.error ?? "invalid"}`, verdict.error ?? "invalid");
  }
  const result = applyRules(sample, [rule], { phase: "display" });
  const matches = result.traces[0]?.matches ?? [];
  if (matches.length === 0) {
    return say("regex_lab show: 0 matches", `${sample}\n${"-".repeat(Math.min(sample.length, 80))}\nnothing matched.`);
  }

  // One ruler per LINE of the sample, so a multi-line sample does not smear its carets onto the
  // wrong row. Offsets are absolute, so each line subtracts its own start.
  const lines = sample.split("\n");
  const out: string[] = [];
  let lineStart = 0;
  let counter = 0;
  const numbered: string[] = [];
  for (const line of lines) {
    const lineEnd = lineStart + line.length;
    // A CHARACTER buffer, not a list of chunks. The first version pushed "^^^^^^^^" as one element
    // and then measured position with marks.length, so every ruler after the first drifted right by
    // (match width - 1) - the carets sat under the wrong word while looking perfectly plausible.
    const marks: string[] = [];
    const put = (at: number, width: number): void => {
      while (marks.length < at + width) marks.push(" ");
      for (let i = 0; i < width; i++) marks[at + i] = "^";
    };
    for (const m of matches) {
      if (m.whole.start >= lineStart && m.whole.start < lineEnd) {
        counter += 1;
        const at = m.whole.start - lineStart;
        const width = Math.max(1, Math.min(m.whole.end, lineEnd) - m.whole.start);
        put(at, width);
        numbered.push(
          `  ${String(counter).padStart(2)}  ${JSON.stringify(sample.slice(m.whole.start, m.whole.end))}` +
          (m.groups.length
            ? `\n      groups: ${m.groups.map((g, i) =>
              g ? `$${i + 1}=${JSON.stringify(sample.slice(g.start, g.end))}` : `$${i + 1}=(no match)`).join("  ")}`
            : ""),
        );
      }
    }
    out.push(line);
    if (marks.length) out.push(marks.join(""));
    lineStart = lineEnd + 1;
  }

  return say(`regex_lab show: ${matches.length} match${matches.length === 1 ? "" : "es"}`, [
    `/${args.find}/${args.flags}`,
    ``,
    ...out,
    ``,
    ...numbered,
  ].join("\n"));
};

/**
 * A bake-off: several candidate patterns over the same text, scored side by side.
 *
 * The moment this is for is real and common - you have three ways to write the same rule and no idea
 * which over-matches. Running them one at a time and remembering the counts is exactly the kind of
 * thing a person gets wrong, and it is free to just run them all.
 */
const race = (args: Input): ToolResult => {
  if (!args.rules?.length) return say("regex_lab race: no candidates", "Pass `rules` - the patterns to compare.");
  const sample = args.sample;
  if (sample === undefined) return say("regex_lab race: no sample", "Pass `sample`.");
  const rows: string[] = [];
  let best: { label: string; hits: number } | null = null;
  for (const [i, candidate] of args.rules.entries()) {
    const rule = asRule(candidate, i);
    const verdict = validateRule(rule);
    if (!verdict.ok) {
      rows.push(`  ${(candidate.label || `#${i + 1}`).padEnd(18)} REFUSED  ${verdict.error ?? ""}`);
      continue;
    }
    const result = applyRules(sample, [rule], { phase: "display" });
    const trace = result.traces[0];
    const hits = trace?.matchCount ?? 0;
    const caught = (trace?.matches ?? [])
      .slice(0, 3)
      .map((m) => JSON.stringify(sample.slice(m.whole.start, m.whole.end)))
      .join(" ");
    rows.push(
      `  ${(candidate.label || `#${i + 1}`).padEnd(18)} ${String(hits).padStart(3)} hit${hits === 1 ? " " : "s"}` +
      `  ${bar(hits, 12).padEnd(12)}  ${caught}`,
    );
    if (!best || hits > best.hits) best = { label: candidate.label || `#${i + 1}`, hits };
  }
  return say(`regex_lab race: ${args.rules.length} candidates`, [
    `over ${JSON.stringify(sample.slice(0, 70))}${sample.length > 70 ? "..." : ""}`,
    ``,
    ...rows,
    ``,
    // MOST hits is not automatically best - over-matching is the usual regex failure, so the tool
    // reports the spread and refuses to crown a winner it cannot actually judge.
    `Most matches is not the same as most correct: over-matching is the usual way a rule goes wrong.`,
    `Use \`show\` on the one you like to see exactly where it lands.`,
  ].join("\n"));
};

const read = (args: Input): ToolResult => {
  if (!args.find) return say("regex_lab read: no pattern", "Pass `find`.");
  const r = readoutFor(args.find, args.flags, { rng: steadyRng() });
  const lines = [`pattern  /${args.find}/${args.flags}`, ``];
  lines.push(r.reading ? `in plain words:\n  ${r.reading}` : `This pattern will not parse.`);
  if (r.mode.length) lines.push(``, `mode   ${r.mode.join(", ")}`);
  if (r.uses.length) lines.push(`uses   ${r.uses.join(", ")}`);
  if (r.words.length) lines.push(`words  ${r.words.join(", ")}`);
  if (r.matches.length) {
    lines.push(``, `it catches (run through the engine, not guessed):`);
    for (const m of r.matches) lines.push(`  ${JSON.stringify(m)}`);
  }
  if (r.nearMisses.length) {
    lines.push(``, `it does NOT catch:`);
    for (const m of r.nearMisses) lines.push(`  ${JSON.stringify(m)}`);
  }
  return say(`regex_lab read: ${(r.reading || args.find).slice(0, 60)}`, lines.join("\n"));
};

const lint = (args: Input): ToolResult => {
  if (!args.rules?.length) return say("regex_lab lint: no rules", "Pass `rules`.");
  const rules = args.rules.map(asRule);
  const findings = inspectSet({ name: "lab set", rules });
  if (findings.length === 0) {
    return say("regex_lab lint: clean", `${rules.length} rule${rules.length === 1 ? "" : "s"}, nothing found.`);
  }
  const problems = findings.filter((f) => f.severity === "problem").length;
  const lines = findings.map((f) => {
    const mark = f.severity === "problem" ? "!" : "-";
    const where = f.ruleId ? ` [${f.ruleId}]` : "";
    const fixable = f.fix ? "  (fixable)" : "";
    return `${mark} ${f.rule}${where}: ${f.message}${fixable}`;
  });
  return say(
    `regex_lab lint: ${findings.length} finding${findings.length === 1 ? "" : "s"}${problems ? `, ${problems} problem${problems === 1 ? "" : "s"}` : ""}`,
    lines.join("\n"),
  );
};

const recipes = (args: Input): ToolResult => {
  if (args.recipe) {
    const one = TEMPLATE_CATALOG.find((t) => t.id === args.recipe);
    if (!one) {
      return say(
        `regex_lab recipes: no recipe "${args.recipe}"`,
        `Known ids: ${TEMPLATE_CATALOG.map((t) => t.id).join(", ")}`,
      );
    }
    return say(`regex_lab recipes: ${one.id}`, [
      one.name,
      one.does,
      ``,
      `find     /${one.find}/${one.flags}`,
      `replace  ${one.replace === "" ? "(delete the match)" : one.replace}`,
      `phases   ${one.phases.join(", ")}`,
      ``,
      `before   ${JSON.stringify(one.before)}`,
      `after    ${JSON.stringify(one.after)}`,
    ].join("\n"));
  }
  const byCategory = new Map<string, string[]>();
  for (const t of TEMPLATE_CATALOG) {
    const rows = byCategory.get(t.category) ?? [];
    rows.push(`  ${t.id.padEnd(26)} ${t.does}`);
    byCategory.set(t.category, rows);
  }
  const lines: string[] = [
    `Starter recipes. Every before/after below was computed BY THE ENGINE, never hand-written,`,
    `so a recipe cannot promise something the pattern does not do.`,
  ];
  for (const [category, rows] of byCategory) {
    lines.push(``, category.toUpperCase(), ...rows);
  }
  lines.push(``, `Ask for one by id to get its pattern and worked example.`);
  return say(`regex_lab recipes: ${TEMPLATE_CATALOG.length}`, lines.join("\n"));
};

const fromExamples = (args: Input): ToolResult => {
  if (!args.examples?.length) {
    return say("regex_lab from_examples: no examples", "Pass `examples` - phrases it should catch.");
  }
  const built = buildFromExamples(args.examples);
  if (built.pattern === "") {
    return say(
      "regex_lab from_examples: nothing shared",
      "Those phrases share no structure this builder can turn into one pattern. Try examples that " +
      "differ in only one or two places.",
    );
  }
  return say(`regex_lab from_examples: /${built.pattern}/${built.flags}`, [
    `From ${args.examples.length} example${args.examples.length === 1 ? "" : "s"}:`,
    ``,
    `find   /${built.pattern}/${built.flags}`,
    ``,
    `Run it through \`try\` against real text before saving. A pattern built from examples matches`,
    `the SHAPE those examples share, which is usually wider than the author intended.`,
  ].join("\n"));
};

const regexLab: HarnessTool<Input> = {
  name: "regex_lab",
  description:
    "Work on a regex before saving it: try it against real text and see what changed, read what it " +
    "does in plain words, lint a set for bombs and dead rules, browse starter recipes, or build a " +
    "pattern from example phrases. Read-only - nothing is saved.",
  exposure: "direct",
  effect: "read",
  input,
  concurrencyKey: () => "regex-lab",

  async execute(args: Input): Promise<ToolResult> {
    switch (args.action) {
      case "try": return tryIt(args);
      case "show": return show(args);
      case "race": return race(args);
      case "read": return read(args);
      case "lint": return lint(args);
      case "recipes": return recipes(args);
      case "from_examples": return fromExamples(args);
    }
  },
};

export default regexLab;
