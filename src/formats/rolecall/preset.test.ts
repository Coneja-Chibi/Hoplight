/**
 * RoleCall preset codec tests: the bundle fingerprint claims, identity + escrow ride under
 * original.rolecall, the wire logic itself is the shared st-preset pair (proven in
 * sillytavern/preset.test.ts) - here we pin the RC-specific seams.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import rolecallPreset, { isRolecallPresetExport } from "./preset";

const FIXTURE = readFileSync(join(import.meta.dir, "../../../samples/rolecall/presets/spec-walk.preset.json"), "utf8");
const input = { text: FIXTURE, filename: "spec-walk.preset.json" };

test("detect: the bundle fingerprint claims at 0.95; plain flat presets are refused to the ST codec", () => {
  expect(rolecallPreset.detect(input)).toBe(0.95);
  expect(rolecallPreset.detect({ text: JSON.stringify({ temperature: 1, top_p: 1, prompts: [], prompt_order: [] }) })).toBe(0);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: { linkedRegexScripts: [] } })).toBe(true);
  expect(isRolecallPresetExport({ temperature: 1, top_p: 1, extensions: {} })).toBe(false);
});

test("toCanonical rides escrow under original.rolecall and round-trips through its own emit", () => {
  const first = rolecallPreset.toCanonical(input);
  expect(first.original?.rolecall?.raw).toBeDefined();
  expect(first.original?.sillytavern).toBeUndefined();
  const emitted = rolecallPreset.fromCanonical(first);
  const again = rolecallPreset.toCanonical({ text: emitted.text!, filename: "spec-walk.preset.json" });
  expect(again.body).toEqual(first.body);
});

test("extractRegex surfaces the bundle from the RC escrow key", () => {
  const set = rolecallPreset.extractRegex!(rolecallPreset.toCanonical(input));
  expect(set).not.toBeNull();
  expect(set!.body.rules.length).toBeGreaterThan(0);
});
