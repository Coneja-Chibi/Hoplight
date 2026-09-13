/** RoleCall-specific preset detection, mapping, and round-trip coverage. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSerializeReport } from "../../core/reports";
import rolecallPreset, { isRolecallPresetExport } from "./preset";

const FIXTURE = readFileSync(join(import.meta.dir, "../../../samples/rolecall/presets/spec-walk.preset.json"), "utf8");
const input = { text: FIXTURE, filename: "spec-walk.preset.json" };

test("detect: RC keys claim; a bare regex_scripts bundle does NOT (ST presets bundle regex too)", () => {
  expect(rolecallPreset.detect(input)).toBe(0.95);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, macro_engine_yaml: "dashboard:\n" })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, choice_groups: [] })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: { linkedRegexScripts: [] } })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: { regex_scripts: [{ scriptName: "s" }] } })).toBe(false);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, prompts: [], prompt_order: [] })).toBe(false);
});

test("native mappings: wire name wins over the filename, readme becomes description, choices map", () => {
  const e = rolecallPreset.toCanonical(input);
  expect(e.body.name).toBe("Spec Walk RC");
  expect(e.body.description).toContain("spec-walk preset");
  expect(e.body.choices).toHaveLength(2);
  const lang = e.body.choices![0]!;
  expect(lang.type).toBe("input");
  expect(lang.readme).toBe("Write ALL output in this language.");
  expect(lang.suggestions).toEqual(["English", "Spanish"]);
  const pace = e.body.choices![1]!;
  expect(pace.key).toBe("pace");
  expect(pace.options.map((o) => o.value)).toEqual(["slow", "fast"]);
  // the YAML rides sealed on the twin, never parsed, never executed
  expect((e.original?.rolecall?.raw as Record<string, unknown>).macro_engine_yaml).toContain("dashboard:");
});

test("unedited round-trip: the emit re-parses deep-equal, RC keys ride the twin untouched", () => {
  const first = rolecallPreset.toCanonical(input);
  const emitted = JSON.parse(rolecallPreset.fromCanonical(first).text!) as Record<string, unknown>;
  expect(emitted.name).toBe("Spec Walk RC");
  expect(emitted.macro_engine_yaml).toBe((JSON.parse(FIXTURE) as Record<string, unknown>).macro_engine_yaml);
  expect(emitted.choice_groups).toEqual((JSON.parse(FIXTURE) as Record<string, unknown>).choice_groups);
  const again = rolecallPreset.toCanonical({ text: JSON.stringify(emitted), filename: "spec-walk.preset.json" });
  expect(again.body).toEqual(first.body);
});

test("edited choices rebuild choice_groups from canonical (sparse, like the source)", () => {
  const e = rolecallPreset.toCanonical(input);
  e.body.choices![0]!.label = "Output Language";
  const emitted = JSON.parse(rolecallPreset.fromCanonical(e).text!) as { choice_groups: { label: string }[] };
  expect(emitted.choice_groups[0]!.label).toBe("Output Language");
});

test("extractRegex still surfaces the bundle from the RC escrow key", () => {
  const set = rolecallPreset.extractRegex!(rolecallPreset.toCanonical(input));
  expect(set).not.toBeNull();
  expect(set!.body.rules.length).toBeGreaterThan(0);
});

test("serialize report recognizes the RoleCall preset's own escrow", () => {
  const report = buildSerializeReport(rolecallPreset.toCanonical(input), rolecallPreset);
  expect(report.dropped).toEqual([]);
});

test("from-scratch output carries a neutral RoleCall fingerprint and is self-readable", () => {
  const output = rolecallPreset.fromCanonical({
    schemaVersion: "1",
    kind: "preset",
    id: "fresh",
    body: { name: "Fresh", prompts: [] },
  });

  expect(JSON.parse(output.text!).choice_groups).toEqual([]);
  expect(rolecallPreset.detect(output)).toBe(0.95);
  expect(rolecallPreset.toCanonical(output).body.name).toBe("Fresh");
});
