/**
 * The settings half of a starter preset: what a file must carry beyond its blocks to load without
 * inheriting whatever the application had open last.
 *
 * TRANSCRIBED, NOT INVENTED. Every value below is copied from SillyTavern's own shipped default,
 * `default/content/presets/openai/Default.json`, which is the file a fresh install starts from. That
 * matters because a wrong sampler value renders perfectly and is not noticed for weeks; the only
 * defensible source is the one the platform itself ships. `starter-settings.live.test.ts` reads that
 * file when an install is present and fails if any value here has drifted from it, so the claim in
 * this comment is checkable rather than asserted.
 *
 * THE CONNECTION FIELDS ARE DELIBERATELY ABSENT, and this is the part worth reading. ST's default
 * also carries `chat_completion_source`, a model name for each of thirteen providers, `custom_url`,
 * `reverse_proxy` and `proxy_password`. Those describe the machine a preset was made on, not the
 * preset. Carrying them would mean opening a starter silently retargets somebody's connection, and
 * a preset file that ships a proxy password field is a credential shaped like craft. A starter
 * therefore leaves the connection alone and the application keeps whatever it already had, which is
 * the one place inheriting the current setting is the right answer.
 *
 * TWO VALUES LOOK WRONG AND ARE NOT. `maxContext` is 4095 and `maxTokens` is 300, which are small
 * enough to read as a mistake. They are what ST ships. Raising them here would be inventing a
 * number, so they are carried verbatim and named here instead, since a starter is a thing people
 * edit and this is the first edit most will want.
 */
import type { PresetBody } from "../../../entities/preset";

/** Where every value here came from, so a reader can check rather than trust. */
export const STARTER_SETTINGS_SOURCE = "SillyTavern default/content/presets/openai/Default.json";

/**
 * The settings groups a starter carries. Spread into a body beside its blocks.
 *
 * Typed as the settings-only slice of PresetBody so a field that does not exist on the canonical
 * shape cannot be added here by hand; the adapter still owns how each one reaches the wire.
 */
export const starterSettings = (): Omit<PresetBody, "name" | "prompts"> => ({
  samplers: {
    temperature: 1,
    topP: 1,
    topK: 0,
    topA: 0,
    minP: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    repetitionPenalty: 1,
    // ST's shipped numbers. Small, and deliberately not corrected here; see the header.
    maxContext: 4095,
    maxTokens: 300,
  },
  systemPrompts: {
    impersonation:
      "[Write your next reply from the point of view of {{user}}, using the chat history so far as a"
      + " guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't"
      + " describe actions of {{char}}.]",
    newChat: "[Start a new Chat]",
    newGroupChat: "[Start a new group chat. Group members: {{group}}]",
    newExampleChat: "[Example Chat]",
    continueNudge:
      "[Continue your last message without repeating its original content.]",
    groupNudge: "[Write the next reply only as {{char}}.]",
    assistantPrefill: "",
    assistantImpersonation: "",
  },
  templates: {
    worldInfoFormat: "{0}",
    scenarioFormat: "{{scenario}}",
    personalityFormat: "{{personality}}",
  },
  behavior: {
    namesBehavior: 0,
    sendIfEmpty: "",
    continuePrefill: false,
    continuePostfix: " ",
  },
  apiOptions: {
    streamResponses: true,
    claudeUseSystemPrompt: false,
    squashSystemMessages: false,
  },
  media: {
    imageInlining: true,
  },
  generation: {
    seed: -1,
    completions: 1,
    maxContextUnlocked: false,
    biasPreset: "Default (none)",
  },
});
