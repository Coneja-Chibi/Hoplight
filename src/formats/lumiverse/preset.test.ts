/**
 * Lumiverse preset codec tests: wrapper detection, the block model (category, chat_history,
 * content, collision guard), variable-defaults synthesis, and body-level round-trip through the
 * shared ST wire (spec: specs/formats/lumiverse-preset.md).
 */
import { expect, test } from "bun:test";
import lumiversePreset, { isLumiverseWrapper, lumiverseToStRaw } from "./preset";
import stPreset from "../sillytavern/preset";

const WRAPPER = {
  type: "lumiverse_preset",
  schemaVersion: 2,
  cover_url: "https://example.test/cover.png",
  preset: {
    id: "lp-1",
    name: "ThreadBare-like",
    description: "a community preset",
    blocks: [
      { id: "cat-a", name: "Pacing", marker: "category", enabled: true },
      { id: "b1", name: "Opening", content: "Set the scene.", role: "system", enabled: true, depth: 3, isLocked: true },
      { id: "chatHistory", name: "History", marker: "chat_history", enabled: true, depth: 2 },
      { id: "b2", name: "Disabled extra", content: "off", role: "user", enabled: false },
      { id: "lumiverseVariableDefaults", name: "Sneaky collision", content: "x", enabled: true },
    ],
    promptBehavior: { impersonationPrompt: "Speak as {{user}}.", emptySendNudge: "go on" },
    completionSettings: { continuePrefill: true },
    samplerOverrides: { temperature: 0.8, contextSize: 16000 },
    advancedSettings: { seed: 7, customStopStrings: ["###"] },
    promptVariables: {
      b1: { pace: "slow", "bad::name": "x" },
      b2: { pace: "fast", tone: "grim" },
    },
  },
};

const input = { text: JSON.stringify(WRAPPER), filename: "threadbare.json" };

test("detect: exact wrapper predicate only", () => {
  expect(lumiversePreset.detect(input)).toBe(1);
  expect(isLumiverseWrapper({ type: "lumiverse_preset" })).toBe(false); // no preset object
  expect(lumiversePreset.detect({ text: JSON.stringify({ temperature: 1, top_p: 1 }) })).toBe(0);
});

test("conversion: blocks map per the spec, collision guard namespaces, order carries enabled", () => {
  const raw = lumiverseToStRaw(WRAPPER as never);
  const rows = raw.prompts as Record<string, unknown>[];
  const ids = rows.map((r) => r.identifier);
  // defaults prompt first, then category divider, content, chatHistory marker, disabled, namespaced collision
  expect(ids).toEqual([
    "lumiverseVariableDefaults",
    "cat-a",
    "b1",
    "chatHistory",
    "b2",
    "__lumiverse_block_lumiverseVariableDefaults",
  ]);
  const divider = rows.find((r) => r.identifier === "cat-a")!;
  expect(divider.name).toBe("━━━ Pacing ━━━");
  const b1 = rows.find((r) => r.identifier === "b1")!;
  expect(b1.forbid_overrides).toBe(true);
  expect(b1.injection_depth).toBe(3);
  expect(raw.temperature).toBe(0.8);
  expect(raw.openai_max_context).toBe(16000);
  expect(raw._lumiverse_empty_send_nudge).toBe("go on");
  const order = (raw.prompt_order as { order: { identifier: string; enabled: boolean }[] }[])[0]!.order;
  expect(order.find((o) => o.identifier === "b2")!.enabled).toBe(false);
});

test("variable defaults: first-write-wins, macro-significant pairs dropped, guarded setvar lines", () => {
  const raw = lumiverseToStRaw(WRAPPER as never);
  const defaults = (raw.prompts as Record<string, unknown>[])[0]!;
  const content = defaults.content as string;
  expect(content).toContain("{{if {{hasvar::pace}}}}{{else}}{{setvar::pace::slow}}{{/if}}"); // b1 wins over b2
  expect(content).toContain("{{setvar::tone::grim}}");
  expect(content).not.toContain("bad::name");
});

test("toCanonical: category becomes a GROUP, marker becomes a marker, name from the wrapper", () => {
  const e = lumiversePreset.toCanonical(input);
  expect(e.body.name).toBe("ThreadBare-like");
  expect(e.body.groups?.map((g) => g.name)).toEqual(["Pacing"]);
  const byId = new Map(e.body.prompts.map((p) => [p.id, p]));
  expect(byId.get("b1")!.groupId).toBe("cat-a");
  expect(byId.get("chatHistory")!.marker).toBe(true);
  expect(byId.get("b2")!.enabled).toBe(false);
  expect(byId.has("cat-a")).toBe(false); // dividers are never prompts
});

test("round-trip: emit is a valid ST flat preset whose reparse is body-deep-equal", () => {
  const first = lumiversePreset.toCanonical(input);
  const emitted = lumiversePreset.fromCanonical(first);
  const stBody = JSON.parse(emitted.text!) as Record<string, unknown>;
  expect(Array.isArray(stBody.prompts)).toBe(true);
  expect(stBody._lumiverse_source).toBe(true); // escrow siblings survive on the ST twin
  // reparse through the sillytavern-preset codec: import parity is the round-trip bar for an
  // import-first codec (the wrapper itself is never reproduced, per the spec's non-goal)
  const second = stPreset.toCanonical({ text: emitted.text!, filename: "threadbare.json" });
  expect(second.body.prompts).toEqual(first.body.prompts);
  expect(second.body.groups).toEqual(first.body.groups);
  expect(second.body.samplers).toEqual(first.body.samplers);
});
