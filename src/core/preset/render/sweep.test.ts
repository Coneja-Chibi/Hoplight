/**
 * The preset sweep.
 *
 * The risks are the ones that make a report untrustworthy rather than absent: one bad preset taking
 * the whole run down, results arriving in whatever order they finished, and an unbounded pool
 * starting a process per preset. Those are what is pinned. The renderer itself is proven live in
 * runner.live.test.ts; here it is a stub, because what is being tested is the sweep.
 */
import { describe, expect, test } from "bun:test";
import { formatSweep, sweepPresets, type SweepReport } from "./sweep";

/**
 * A fake renderer, driven by the preset path.
 *
 * `bun` running an inline script keeps this honest: it goes through the real runRenderer, the real
 * spawn and the real reply parsing, so the sweep is exercised against the contract rather than
 * against a mock of it.
 */
const fakeRenderer = (script: string) => ({ command: "bun", args: ["-e", script] });

/** Reads the preset path off stdin and answers per the convention encoded in the name. */
const SCRIPT = `
const raw = await new Response(Bun.stdin.stream()).text();
const preset = JSON.parse(raw).preset;
if (preset.includes("boom")) { process.stderr.write("engine exploded"); process.exit(1); }
const unresolved = preset.includes("dirty")
  ? [{ token: "{{alpha}}", count: 2 }, { token: "{{beta}}", count: 1 }]
  : [];
process.stdout.write(JSON.stringify({
  prompt: "assembled",
  unresolved,
  warnings: [],
  engine: { name: "fake", version: "1.0.0", source: "test" },
}));
`;

const sweep = (presets: string[]): Promise<SweepReport> =>
  sweepPresets(fakeRenderer(SCRIPT), presets, { timeoutMs: 30_000 });

describe("sweepPresets", () => {
  test("counts clean, dirty and failed separately", async () => {
    const report = await sweep(["a-clean", "b-dirty", "c-boom"]);
    expect(report.clean).toBe(1);
    expect(report.dirty).toBe(1);
    expect(report.failed).toBe(1);
  }, 120_000);

  test("ONE BROKEN PRESET DOES NOT COST THE REPORT", async () => {
    // The whole value of a sweep is "which of these are broken", so stopping at the first broken one
    // would answer the question by refusing to.
    const report = await sweep(["a-boom", "b-clean", "c-clean"]);
    expect(report.failed).toBe(1);
    expect(report.clean).toBe(2);
    expect(report.entries[0]!.ok).toBe(false);
    expect(report.entries[0]!.detail).toBeTruthy();
  }, 120_000);

  test("order follows the input, not completion", async () => {
    // A report that reshuffles between runs cannot be diffed against the last one.
    const presets = ["one-clean", "two-dirty", "three-clean", "four-dirty"];
    const report = await sweep(presets);
    expect(report.entries.map((e) => e.preset)).toEqual(presets);
  }, 120_000);

  test("names the distinct tokens, and counts every occurrence", async () => {
    const report = await sweep(["x-dirty"]);
    const entry = report.entries[0]!;
    expect(entry.unresolved).toBe(3); // 2 + 1
    expect(entry.tokens).toEqual(["{{alpha}}", "{{beta}}"]);
  }, 120_000);

  test("an empty list is an empty report, not a crash", async () => {
    const report = await sweep([]);
    expect(report.entries).toEqual([]);
    expect(report.clean + report.dirty + report.failed).toBe(0);
  }, 60_000);

  test("the pool never exceeds the work, so one preset starts one process", async () => {
    const report = await sweepPresets(fakeRenderer(SCRIPT), ["solo-clean"], { pool: 8, timeoutMs: 30_000 });
    expect(report.entries).toHaveLength(1);
    expect(report.clean).toBe(1);
  }, 60_000);
});

describe("formatSweep", () => {
  const report: SweepReport = {
    entries: [
      { preset: "good.json", ok: true, unresolved: 0, tokens: [] },
      { preset: "bad.json", ok: true, unresolved: 3, tokens: ["{{a}}", "{{b}}"] },
      { preset: "gone.json", ok: false, detail: "no such file" },
    ],
    clean: 1,
    dirty: 1,
    failed: 1,
  };

  test("leads with the counts, then only the presets with something to say", () => {
    const text = formatSweep(report);
    expect(text).toContain("1 clean");
    expect(text).toContain("bad.json");
    expect(text).toContain("gone.json");
    // A clean preset needs no line: a sweep over forty should not print forty rows to say nothing.
    expect(text).not.toContain("good.json");
  });

  test("says so plainly when everything resolved", () => {
    const clean: SweepReport = { entries: [report.entries[0]!], clean: 1, dirty: 0, failed: 0 };
    expect(formatSweep(clean)).toContain("Every preset resolved completely.");
  });

  test("an empty sweep says there was nothing to check", () => {
    expect(formatSweep({ entries: [], clean: 0, dirty: 0, failed: 0 })).toContain("No presets");
  });
});
