/**
 * Lumiverse regex codec: full account wire + versioned export file, and the reduced module-embedded
 * shape confirmed live in character-export.service.ts (REGEX-JEWEL-PLAN.md R1 residual Q2).
 */
import { describe, test, expect } from "bun:test";
import {
  decodeLumiverseRegexScript,
  encodeLumiverseRegexScript,
  decodeLumiverseRegexFile,
  encodeLumiverseRegexFile,
  decodeLumiverseModuleRegexScripts,
  encodeLumiverseModuleRegexScripts,
  type LumiverseRegexScriptWire,
  type LumiverseModuleRegexScript,
} from "./regex";
import { rehydrateCardData, packModulesFromExtensions } from "./modules";

// 1. Full account RegexScript <-> canonical -----------------------------------------------------

const ACCOUNT_WIRE: LumiverseRegexScriptWire = {
  id: "rgx_1",
  user_id: "usr_1",
  name: "Strip stage directions",
  script_id: "stable-strip-stage",
  find_regex: "\\*([^*]+)\\*",
  replace_string: "",
  flags: "g",
  placement: ["ai_output", "world_info", "memory"],
  scope: "character",
  scope_id: "char_9",
  target: ["response", "display"],
  min_depth: 0,
  max_depth: 4,
  trim_strings: ["  "],
  run_on_edit: true,
  substitute_macros: "after",
  disabled: false,
  sort_order: 2,
  description: "Removes *asterisk* stage directions",
  folder: "Cleanup",
  pack_id: "pack_7",
  preset_id: null,
  metadata: { source: "author", RegexPerformanceMetadata: { slow: false, elapsed_ms: 3 } },
  created_at: 1700000000,
  updated_at: 1700000500,
};

test("decodeLumiverseRegexScript maps core fields, memory phase, after mode, target matrix", () => {
  const rule = decodeLumiverseRegexScript(ACCOUNT_WIRE);
  expect(rule.id).toBe("rgx_1");
  expect(rule.label).toBe("Strip stage directions");
  expect(rule.find).toBe("\\*([^*]+)\\*");
  expect(rule.flags).toBe("g");
  expect(rule.replace).toBe("");
  // world_info -> lorebook, ai_output -> output, memory stays memory (Lumi-only phase).
  expect(rule.phases).toEqual(["output", "lorebook", "memory"]);
  expect(rule.targets).toEqual(["response", "display"]);
  expect(rule.substituteFind).toBe("after");
  expect(rule.minDepth).toBe(0);
  expect(rule.maxDepth).toBe(4);
  expect(rule.runOnEdit).toBe(true);
  expect(rule.enabled).toBe(true);
  expect(rule.sortOrder).toBe(2);
  expect(rule.note).toBe("Removes *asterisk* stage directions");
  // No first-class canonical home: sealed in extras (the lossless-escrow doctrine).
  expect(rule.extras?.userId).toBe("usr_1");
  expect(rule.extras?.scriptId).toBe("stable-strip-stage");
  expect(rule.extras?.scope).toBe("character");
  expect(rule.extras?.scopeId).toBe("char_9");
  expect(rule.extras?.folder).toBe("Cleanup");
  expect(rule.extras?.packId).toBe("pack_7");
  expect(rule.extras?.metadata).toEqual(ACCOUNT_WIRE.metadata);
});

test("full account wire round-trips byte-equal when unedited (R1 must #6)", () => {
  const rule = decodeLumiverseRegexScript(ACCOUNT_WIRE);
  const wireOut = encodeLumiverseRegexScript(rule);
  expect(wireOut).toEqual(ACCOUNT_WIRE);
});

test("interactive actions ride extras sealed and round-trip byte-equal; absent key is never fabricated", () => {
  const actions = [
    {
      id: "pick-scene",
      type: "send",
      multi_select: true,
      cost: "$1",
      limit: "$2",
      title: "Pick a scene",
      subtitle: "Claimed until the next send",
      content: "I choose {{$1}}.",
      effects: [
        { type: "set_state", key: "scene", value: "$1" },
        { type: "draft", content: "Continue in $1", mode: "append" },
        { type: "fork" },
      ],
    },
    { id: "hint", type: "append", multi_select: false, cost: "", limit: "", title: "Hint", subtitle: "", content: "hidden appendix" },
  ];
  const wire: LumiverseRegexScriptWire = { ...ACCOUNT_WIRE, actions };
  const rule = decodeLumiverseRegexScript(wire);
  expect(rule.extras?.actions).toEqual(actions);
  expect(encodeLumiverseRegexScript(rule)).toEqual(wire);
  // pre-actions files stay pre-actions on emit
  expect("actions" in encodeLumiverseRegexScript(decodeLumiverseRegexScript(ACCOUNT_WIRE))).toBe(false);
});

test("disabled row decodes to enabled=false and re-encodes disabled=true", () => {
  const wire: LumiverseRegexScriptWire = { ...ACCOUNT_WIRE, disabled: true };
  const rule = decodeLumiverseRegexScript(wire);
  expect(rule.enabled).toBe(false);
  expect(encodeLumiverseRegexScript(rule).disabled).toBe(true);
});

test("unmapped placement values are preserved (never dropped) and re-emitted on encode", () => {
  const wire: LumiverseRegexScriptWire = { ...ACCOUNT_WIRE, placement: ["ai_output", "future_phase"] };
  const rule = decodeLumiverseRegexScript(wire);
  expect(rule.phases).toEqual(["output"]);
  expect(rule.extras?.unmappedPlacements).toEqual(["future_phase"]);
  expect(encodeLumiverseRegexScript(rule).placement).toEqual(["ai_output", "future_phase"]);
});

test("substitute_macros outside the known four modes is dropped from substituteFind, never fabricated", () => {
  const wire: LumiverseRegexScriptWire = { ...ACCOUNT_WIRE, substitute_macros: "weird_future_mode" };
  const rule = decodeLumiverseRegexScript(wire);
  expect(rule.substituteFind).toBeUndefined();
  // Re-encode falls back to "none" honestly - the unknown mode was not modeled, not invented back.
  expect(encodeLumiverseRegexScript(rule).substitute_macros).toBe("none");
});

// 2. Versioned standalone export file, both ways -------------------------------------------------

test("decodeLumiverseRegexFile / encodeLumiverseRegexFile round-trip the envelope", () => {
  const fileText = JSON.stringify({
    version: 1,
    type: "lumiverse_regex_scripts",
    scripts: [ACCOUNT_WIRE],
  });
  const rules = decodeLumiverseRegexFile(fileText);
  expect(rules).not.toBeNull();
  expect(rules).toHaveLength(1);
  const rebuilt = encodeLumiverseRegexFile(rules!);
  expect(rebuilt).toEqual({ version: 1, type: "lumiverse_regex_scripts", scripts: [ACCOUNT_WIRE] });
});

test("decodeLumiverseRegexFile rejects the wrong envelope type without throwing", () => {
  expect(decodeLumiverseRegexFile(JSON.stringify({ version: 1, type: "something_else", scripts: [] }))).toBeNull();
  expect(decodeLumiverseRegexFile("not json")).toBeNull();
  expect(decodeLumiverseRegexFile(JSON.stringify({ version: 1 }))).toBeNull();
});

// 3. Reduced module-embedded shape (character archive regex_scripts[]) ---------------------------

const MODULE_WIRE: LumiverseModuleRegexScript = {
  name: "Whisper formatting",
  find_regex: "\\(([^)]+)\\)",
  replace_string: "<i>$1</i>",
  flags: "gi",
  placement: ["ai_output", "world_info"],
  scope: "character",
  scope_id: null,
  target: "response",
  min_depth: null,
  max_depth: null,
  trim_strings: [],
  run_on_edit: false,
  substitute_macros: "raw",
  disabled: false,
  sort_order: 0,
  description: "",
  metadata: { source: "charx_bundle" },
};

test("decodeLumiverseModuleRegexScripts maps the reduced bundle shape (Q2 evidence)", () => {
  const rules = decodeLumiverseModuleRegexScripts([MODULE_WIRE]);
  expect(rules).toHaveLength(1);
  const rule = rules[0]!;
  expect(rule.label).toBe("Whisper formatting");
  expect(rule.phases).toEqual(["output", "lorebook"]);
  // Bundle target is a single string, not an array - held as a one-element canonical targets[].
  expect(rule.targets).toEqual(["response"]);
  expect(rule.substituteFind).toBe("raw");
  expect(rule.extras?.scope).toBe("character");
  expect(rule.extras?.scopeId).toBeNull();
  expect(rule.extras?.metadata).toEqual({ source: "charx_bundle" });
  // No id field exists on this wire shape - the codec assigns a stable positional fallback id.
  expect(rule.id).toBe("lumiverse-module-regex-0");
});

test("module bundle round-trips byte-equal when unedited (R1 must #6)", () => {
  const rules = decodeLumiverseModuleRegexScripts([MODULE_WIRE]);
  expect(encodeLumiverseModuleRegexScripts(rules)).toEqual([MODULE_WIRE]);
});

test("module target widened upstream to string|string[]: array form decodes and re-emits as an array", () => {
  const wire: LumiverseModuleRegexScript = { ...MODULE_WIRE, target: ["response", "display"] };
  const rules = decodeLumiverseModuleRegexScripts([wire]);
  expect(rules[0]!.targets).toEqual(["response", "display"]);
  expect(encodeLumiverseModuleRegexScripts(rules)).toEqual([wire]);
  // and the original single-string form still re-emits as a string, not a one-element array
  const single = decodeLumiverseModuleRegexScripts([MODULE_WIRE]);
  expect(encodeLumiverseModuleRegexScripts(single)[0]!.target).toBe("response");
});

test("module bundle with multiple rows round-trips the whole array in order", () => {
  const second: LumiverseModuleRegexScript = {
    ...MODULE_WIRE,
    name: "Second rule",
    disabled: true,
    sort_order: 1,
    target: "",
  };
  const raw = [MODULE_WIRE, second];
  const rules = decodeLumiverseModuleRegexScripts(raw);
  expect(rules).toHaveLength(2);
  expect(rules[1]!.enabled).toBe(false);
  expect(rules[1]!.targets).toBeUndefined();
  expect(encodeLumiverseModuleRegexScripts(rules)).toEqual(raw);
});

test("decodeLumiverseModuleRegexScripts is tolerant: non-array or junk rows never throw", () => {
  expect(decodeLumiverseModuleRegexScripts(null)).toEqual([]);
  expect(decodeLumiverseModuleRegexScripts(undefined)).toEqual([]);
  expect(decodeLumiverseModuleRegexScripts("not an array")).toEqual([]);
  expect(decodeLumiverseModuleRegexScripts([null, 42, "junk", MODULE_WIRE])).toHaveLength(1);
});

// 4. modules.ts sidecar wiring: rehydrate unseals, pack re-seals byte-true when unedited ---------

test("rehydrateCardData unseals regex_scripts to canonical RegexRule[] via the codec", () => {
  const { data } = rehydrateCardData(
    { name: "X", extensions: {} },
    { version: 1, regex_scripts: [MODULE_WIRE] },
    {},
  );
  const ext = data.extensions as Record<string, unknown>;
  const rules = ext._lumiverse_modules_regex_scripts as Array<{ label: string; find: string }>;
  expect(rules).toHaveLength(1);
  expect(rules[0]!.label).toBe("Whisper formatting");
  expect(rules[0]!.find).toBe("\\(([^)]+)\\)");
});

test("rehydrate -> pack round-trips the regex sidecar byte-true when unedited (R1 must #6)", () => {
  const { data } = rehydrateCardData(
    { name: "X", extensions: {} },
    { version: 1, regex_scripts: [MODULE_WIRE] },
    {},
  );
  const { modules } = packModulesFromExtensions(data.extensions, {});
  expect(modules?.regex_scripts).toEqual([MODULE_WIRE]);
});

// -- adapter shell (file home: the versioned lumiverse_regex_scripts envelope) ---------------------

import { regexAdapter } from "./regex";

describe("regexAdapter shell - detection truth table", () => {
  const file = { version: 1, type: "lumiverse_regex_scripts", scripts: [ACCOUNT_WIRE] };

  test("claims the self-identifying envelope at 1.0", () => {
    expect(regexAdapter.detect({ text: JSON.stringify(file) })).toBe(1);
  });

  test("refuses a bare scripts array (no envelope, not this adapter's wire)", () => {
    expect(regexAdapter.detect({ text: JSON.stringify([ACCOUNT_WIRE]) })).toBe(0);
  });

  test("refuses envelopes with the wrong type tag", () => {
    const wrong = { ...file, type: "lumiverse_presets" };
    expect(regexAdapter.detect({ text: JSON.stringify(wrong) })).toBe(0);
  });
});

describe("regexAdapter shell - round trip", () => {
  test("envelope file -> canonical -> envelope file is deep-equal (unedited)", () => {
    const file = { version: 1, type: "lumiverse_regex_scripts", scripts: [ACCOUNT_WIRE] };
    const entity = regexAdapter.toCanonical({ text: JSON.stringify(file), filename: "My Lumi Scripts.json" });
    expect(entity.kind).toBe("regex");
    expect(entity.body.name).toBe("My Lumi Scripts");
    const out = regexAdapter.fromCanonical(entity);
    expect(JSON.parse(out.text ?? "")).toEqual(file);
  });
});
