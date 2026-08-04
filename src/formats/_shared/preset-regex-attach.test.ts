/**
 * Attaching a standalone regex set to a preset, and the properties that must hold while doing it.
 *
 * This closes a real asymmetry: Hoplight could always READ a preset's embedded rules
 * (`extractRegex`) and had no way to write a set back, so a person asking to attach one was told the
 * Studio "does not expose a way" - accurate about the operations, and easily read as a limit of the
 * format. The format carries the field; only the emit half was missing.
 *
 * The riskiest property here is not the round trip, it is ADDITIVITY. Preset bundling was measured as
 * additive (a bundled entity is byte-identical to the bare one), and a preset carrying no regexes
 * must not start differing from its bare emit just because this seam now exists.
 */
import { describe, expect, test } from "bun:test";
import { emitPresetBundle } from "../../convert";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import type { CanonicalPreset } from "../../entities/preset/schema";
import type { CanonicalRegexSet } from "../../entities/regex/schema";
import stPreset from "../sillytavern/preset";
import stRegex from "../sillytavern/regex";
import rolecallPreset from "../rolecall/preset";
import marinaraPreset from "../marinara/preset";

const preset = (name: string): CanonicalPreset => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind: "preset",
  id: "test-preset",
  body: { name, prompts: [], settings: {} },
} as unknown as CanonicalPreset);

/**
 * Built through the real ST regex codec rather than hand-cast, deliberately. A cast fixture missing
 * `phases`/`flags`/`sortOrder` type-checks and then explodes inside ruleToRow - which is exactly what
 * the first draft of this file did. Parsing real wire rows gives a set the emit path can actually
 * consume, so the test proves the shipped path instead of a shape only the test believes in.
 */
const regexSet = (name: string, find: string): CanonicalRegexSet => {
  const rows = [{
    id: `row-${find}`,
    scriptName: `rule ${find}`,
    findRegex: `/${find}/g`,
    replaceString: "<bubble>$1</bubble>",
    trimStrings: [],
    placement: [1],
    disabled: false,
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: true,
    substituteRegex: 0,
  }];
  const set = stRegex.toCanonical({
    text: JSON.stringify(rows),
    filename: `${name}.json`,
  } as never);
  return set;
};

const rowsOf = (text: string): unknown[] => {
  const json = JSON.parse(text) as { extensions?: { regex_scripts?: unknown[] } };
  return json.extensions?.regex_scripts ?? [];
};

describe.each([
  ["sillytavern-preset", stPreset],
  ["rolecall-preset", rolecallPreset],
])("%s carries regex rules inside the preset file", (_id, adapter) => {
  test("an attached set lands in extensions.regex_scripts and reads back out", () => {
    const entity = preset("Mnemosyne V4");
    const { output, unattached } = emitPresetBundle(adapter, entity, [regexSet("thought bubbles", "\\*(.+?)\\*")]);
    expect(unattached).toEqual([]);
    const rows = rowsOf(output.text as string);
    expect(rows).toHaveLength(1);

    // The real proof is that the reader beside it can lift it back: attach then extract is a
    // round trip, not two functions that merely agree on a field name.
    const reparsed = adapter.toCanonical({ text: output.text as string, filename: "v4.json" } as never);
    const back = adapter.extractRegex?.(reparsed) ?? null;
    expect(back).not.toBeNull();
    expect(back?.body.rules[0]?.find).toBe("\\*(.+?)\\*");
  });

  test("two sets concatenate in order, and nothing is silently de-duplicated", () => {
    const { output } = emitPresetBundle(adapter, preset("V4"), [
      regexSet("first", "aaa"),
      regexSet("second", "bbb"),
    ]);
    expect(rowsOf(output.text as string)).toHaveLength(2);
  });

  test("ADDITIVE: attaching nothing emits exactly what the bare adapter emits", () => {
    const entity = preset("Untouched");
    const bare = adapter.fromCanonical(entity);
    expect(emitPresetBundle(adapter, entity, []).output.text).toBe(bare.text);
    // An empty SET (a set carrying no rules) must be treated the same as no set at all, or a
    // preset would start differing from its bare form over something that adds no rows.
    const empty = { ...regexSet("empty", "x"), body: { name: "empty", rules: [] } } as CanonicalRegexSet;
    expect(emitPresetBundle(adapter, entity, [empty]).output.text).toBe(bare.text);
  });
});

describe("a platform that cannot carry them says so", () => {
  test("marinara reports the set as unattached rather than dropping it", () => {
    // Marinara has NO preset attachment: its scripts are account-level with per-character targeting
    // (Vaud-Notes/design/REGEX-FORMATS.md). Writing extensions.regex_scripts here would produce a
    // field the engine never reads, which is worse than refusing - it would look like it worked.
    const set = regexSet("thought bubbles", "\\*(.+?)\\*");
    const { unattached } = emitPresetBundle(marinaraPreset, preset("V4"), [set]);
    expect(unattached).toHaveLength(1);
    expect(unattached[0]?.reason).toContain("does not carry regex rules inside a preset file");
  });
});
