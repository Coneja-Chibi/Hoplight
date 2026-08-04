/**
 * The transcription, checked against the file it was transcribed from.
 *
 * starter-settings.ts claims its values came from SillyTavern's shipped default rather than from a
 * plausible guess. That claim is the whole justification for the module, and a comment cannot carry
 * it: this reads the real file when an install is present and fails on any drift, in either
 * direction. Skipped without an install, because a machine that has no SillyTavern cannot be asked
 * what SillyTavern ships.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { starterSettings } from "./starter-settings";

const ST_ROOT = process.env.HOPLIGHT_ST_ROOT ?? "";
const DEFAULT_PRESET = join(ST_ROOT, "default", "content", "presets", "openai", "Default.json");
const HAVE_ST = existsSync(DEFAULT_PRESET);

/** Canonical field -> the name it carries in a SillyTavern preset. */
const SAMPLERS: Record<string, string> = {
  temperature: "temperature",
  topP: "top_p",
  topK: "top_k",
  topA: "top_a",
  minP: "min_p",
  frequencyPenalty: "frequency_penalty",
  presencePenalty: "presence_penalty",
  repetitionPenalty: "repetition_penalty",
  maxContext: "openai_max_context",
  maxTokens: "openai_max_tokens",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  impersonation: "impersonation_prompt",
  newChat: "new_chat_prompt",
  newGroupChat: "new_group_chat_prompt",
  newExampleChat: "new_example_chat_prompt",
  continueNudge: "continue_nudge_prompt",
  groupNudge: "group_nudge_prompt",
  assistantPrefill: "assistant_prefill",
  assistantImpersonation: "assistant_impersonation",
};

const TEMPLATES: Record<string, string> = {
  worldInfoFormat: "wi_format",
  scenarioFormat: "scenario_format",
  personalityFormat: "personality_format",
};

const BEHAVIOR: Record<string, string> = {
  namesBehavior: "names_behavior",
  sendIfEmpty: "send_if_empty",
  continuePrefill: "continue_prefill",
  continuePostfix: "continue_postfix",
};

const API_OPTIONS: Record<string, string> = {
  streamResponses: "stream_openai",
  claudeUseSystemPrompt: "use_sysprompt",
  squashSystemMessages: "squash_system_messages",
};

const MEDIA: Record<string, string> = { imageInlining: "media_inlining" };

const GENERATION: Record<string, string> = {
  seed: "seed",
  completions: "n",
  maxContextUnlocked: "max_context_unlocked",
  biasPreset: "bias_preset_selected",
};

describe.skipIf(!HAVE_ST)("starter settings match the install they were transcribed from", () => {
  const shipped = HAVE_ST
    ? (JSON.parse(readFileSync(DEFAULT_PRESET, "utf8")) as Record<string, unknown>)
    : {};
  const ours = starterSettings() as unknown as Record<string, Record<string, unknown>>;

  const groups: [string, Record<string, string>][] = [
    ["samplers", SAMPLERS],
    ["systemPrompts", SYSTEM_PROMPTS],
    ["templates", TEMPLATES],
    ["behavior", BEHAVIOR],
    ["apiOptions", API_OPTIONS],
    ["media", MEDIA],
    ["generation", GENERATION],
  ];

  for (const [group, mapping] of groups) {
    test(`${group} is verbatim`, () => {
      for (const [ours_, theirs] of Object.entries(mapping)) {
        expect(
          ours[group]?.[ours_],
          `${group}.${ours_} should equal ${theirs} in ${DEFAULT_PRESET}`,
        ).toEqual(shipped[theirs]);
      }
    });
  }

  test("nothing describing the machine was carried across", () => {
    // The connection fields exist in the shipped file and must NOT be here. Reading them from the
    // real file rather than a hand-written list means a field ST adds later is still caught.
    const connection = Object.keys(shipped).filter((key) =>
      key.endsWith("_model") || key.includes("proxy") || key.includes("custom_")
      || key === "chat_completion_source" || key === "show_external_models",
    );
    expect(connection.length).toBeGreaterThan(5);
    const flat = JSON.stringify(ours);
    for (const key of connection) {
      const value = shipped[key];
      if (typeof value !== "string" || value.length < 4) continue; // "" and flags say nothing
      expect(flat, `${key} leaked into the starter`).not.toContain(value);
    }
  });
});
