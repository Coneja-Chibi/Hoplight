/**
 * Lumiverse preset codec (specs/formats/lumiverse-preset.md). The wrapper's block model converts
 * into the shared ST preset wire (_shared/st-preset-wire, the tavern-fields precedent) and the ST
 * parser does the rest - zero Lumiverse branching downstream. Import-first: the wrapper itself is
 * never reproduced (no serialize path exists upstream either); export writes a plain ST flat
 * preset rebuilt from the deterministic conversion of the escrowed wrapper.
 */
import type { AdapterInput, AdapterOutput, PresetAdapter } from "../../core/adapter";
import type { CanonicalPreset } from "../../entities/preset/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { buildStPreset } from "../_shared/st-preset-emit";
import {
  detectDialect,
  isRec,
  parsedToBody,
  parseStPreset,
  type Rec,
} from "../_shared/st-preset-wire";

const FORMAT_ID = "lumiverse-preset";

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** The exact wrapper predicate (spec "Detection"): type marker + a preset object, nothing else. */
export function isLumiverseWrapper(json: unknown): json is Rec {
  return isRec(json) && json.type === "lumiverse_preset" && isRec(json.preset);
}

/** Reserved identifiers the converter itself synthesizes; colliding block ids get namespaced. */
const RESERVED_IDS = new Set(["chatHistory", "lumiverseVariableDefaults"]);

/** [lumiverse path, ST wire key, coercion] for the settings groups (spec field map). */
const SETTINGS_MAP: ReadonlyArray<readonly [group: string, key: string, wire: string, kind: "num" | "str" | "bool"]> = [
  ["samplerOverrides", "temperature", "temperature", "num"],
  ["samplerOverrides", "topP", "top_p", "num"],
  ["samplerOverrides", "topK", "top_k", "num"],
  ["samplerOverrides", "minP", "min_p", "num"],
  ["samplerOverrides", "presencePenalty", "presence_penalty", "num"],
  ["samplerOverrides", "frequencyPenalty", "frequency_penalty", "num"],
  ["samplerOverrides", "repetitionPenalty", "repetition_penalty", "num"],
  ["samplerOverrides", "maxTokens", "openai_max_tokens", "num"],
  ["samplerOverrides", "contextSize", "openai_max_context", "num"],
  ["samplerOverrides", "streaming", "stream_openai", "bool"],
  ["promptBehavior", "impersonationPrompt", "impersonation_prompt", "str"],
  ["promptBehavior", "newChatPrompt", "new_chat_prompt", "str"],
  ["promptBehavior", "newGroupChatPrompt", "new_group_chat_prompt", "str"],
  ["promptBehavior", "continueNudge", "continue_nudge_prompt", "str"],
  ["promptBehavior", "groupNudge", "group_nudge_prompt", "str"],
  ["promptBehavior", "sendIfEmpty", "send_if_empty", "str"],
  ["completionSettings", "assistantPrefill", "assistant_prefill", "str"],
  ["completionSettings", "assistantImpersonation", "assistant_impersonation", "str"],
  ["completionSettings", "namesBehavior", "names_behavior", "num"],
  ["completionSettings", "continuePrefill", "continue_prefill", "bool"],
  ["completionSettings", "continuePostfix", "continue_postfix", "str"],
  ["completionSettings", "enableWebSearch", "enable_web_search", "bool"],
  ["completionSettings", "sendInlineMedia", "image_inlining", "bool"],
  ["completionSettings", "useSystemPrompt", "claude_use_sysprompt", "bool"],
  ["completionSettings", "squashSystemMessages", "squash_system_messages", "bool"],
  ["completionSettings", "enableFunctionCalling", "function_calling", "bool"],
  ["advancedSettings", "seed", "seed", "num"],
];

/** Merge promptVariables (blockId -> {name: value}) first-write-wins, drop macro-significant pairs,
 * and synthesize the guarded defaults prompt - or null when nothing survives (spec synthesis). */
function variableDefaultsPrompt(promptVariables: unknown): Rec | null {
  if (!isRec(promptVariables)) return null;
  const merged = new Map<string, string>();
  for (const per of Object.values(promptVariables)) {
    if (!isRec(per)) continue;
    for (const [name, value] of Object.entries(per)) {
      if (merged.has(name)) continue; // first write wins across blocks
      const v = String(value);
      const hot = (s: string): boolean => s.includes("::") || s.includes("{{") || s.includes("}}");
      if (hot(name) || hot(v)) continue; // no in-band escape exists; corrupting macros is worse
      merged.set(name, v);
    }
  }
  if (merged.size === 0) return null;
  const lines = [...merged].map(
    ([name, value]) => `{{if {{hasvar::${name}}}}}{{else}}{{setvar::${name}::${value}}}{{/if}}`,
  );
  return {
    identifier: "lumiverseVariableDefaults",
    name: "Variable Defaults (imported)",
    content: lines.join("\n"),
    role: "system",
    enabled: true,
    marker: false,
    injection_position: 0,
    injection_depth: 4,
    injection_order: 100,
    forbid_overrides: false,
    injection_trigger: [],
  };
}

/** Convert the wrapper into an ST-shaped raw preset (deterministic; emit rebuilds via this too). */
export function lumiverseToStRaw(wrapper: Rec): Rec {
  const preset = wrapper.preset as Rec;
  const out: Rec = {};
  for (const [group, key, wire, kind] of SETTINGS_MAP) {
    const g = preset[group];
    if (!isRec(g)) continue;
    const v = kind === "num" ? num(g[key]) : kind === "str" ? str(g[key]) : bool(g[key]);
    if (v !== undefined) out[wire] = v;
  }

  const blocks = (Array.isArray(preset.blocks) ? preset.blocks : []).filter(isRec);
  const rows: Rec[] = [];
  const order: Rec[] = [];
  const push = (row: Rec, enabled: boolean): void => {
    rows.push(row);
    order.push({ identifier: row.identifier, enabled });
  };

  const defaults = variableDefaultsPrompt(preset.promptVariables);
  if (defaults) push(defaults, true);

  for (const b of blocks) {
    const rawId = str(b.id);
    if (rawId === undefined) continue; // non-string id: skipped entirely (spec block model)
    const id = RESERVED_IDS.has(rawId) && b.marker !== "chat_history" ? `__lumiverse_block_${rawId}` : rawId;
    const enabled = b.enabled !== false;
    const role = b.role === "user" || b.role === "assistant" || b.role === "tool" ? b.role : "system";
    if (b.marker === "chat_history") {
      push(
        {
          identifier: "chatHistory", name: "Chat History", content: "", role: "system",
          marker: true, system_prompt: false, injection_position: 0,
          injection_depth: num(b.depth) ?? 4, injection_order: 100, forbid_overrides: false,
          injection_trigger: Array.isArray(b.injectionTrigger) ? b.injectionTrigger : [],
        },
        enabled,
      );
      continue;
    }
    if (b.marker === "category") {
      // decorated so the shared legacy divider detector claims it exactly like a native ST one
      push(
        {
          identifier: id, name: `━━━ ${String(b.name ?? "")} ━━━`, content: "", role: "system",
          system_prompt: false, marker: false,
        },
        enabled,
      );
      continue;
    }
    // block.position: "depth" is the one verified-real value (a real archive's prompt_order carries
    // it) that maps to a real ST injection mode: in-chat at the block's own depth. Any other value,
    // including the spec's still-open "pre_history"/"post_history" question, keeps the prior
    // relative/legacy default rather than guessing an unverified mapping for it.
    push(
      {
        identifier: id, name: String(b.name ?? ""), content: String(b.content ?? ""), role,
        system_prompt: false, marker: false, injection_position: b.position === "depth" ? 1 : 0,
        injection_depth: num(b.depth) ?? 4, injection_order: 100,
        forbid_overrides: b.isLocked === true,
        injection_trigger: Array.isArray(b.injectionTrigger) ? b.injectionTrigger : [],
      },
      enabled,
    );
  }

  out.prompts = rows;
  out.prompt_order = [{ character_id: 100001, order }];

  // the _lumiverse_* sibling convention: wrapper-only values ride the ST raw shape as unknown keys
  const escrow: Rec = { _lumiverse_source: true };
  const lname = str(preset.name);
  if (lname !== undefined) escrow._lumiverse_name = lname;
  const ldesc = str(preset.description);
  if (ldesc !== undefined) escrow._lumiverse_description = ldesc;
  const cover = str(wrapper.cover_url);
  if (cover !== undefined) escrow._lumiverse_cover_url = cover;
  const pb = isRec(preset.promptBehavior) ? preset.promptBehavior : {};
  const nudge = str(pb.emptySendNudge);
  if (nudge !== undefined) escrow._lumiverse_empty_send_nudge = nudge;
  const adv = isRec(preset.advancedSettings) ? preset.advancedSettings : {};
  if (Array.isArray(adv.customStopStrings)) escrow._lumiverse_custom_stop_strings = adv.customStopStrings;
  return { ...out, ...escrow };
}

const lumiversePreset: PresetAdapter = {
  id: FORMAT_ID,
  label: "Lumiverse preset (wrapper import; exports as an ST flat preset)",
  escrowFormatIds: ["lumiverse"],
  outputExtensions: ["json"],
  kind: "preset",

  detect(input: AdapterInput): number {
    return isLumiverseWrapper(readJsonObject(input)) ? 1 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPreset {
    const wrapper = readJsonObject(input);
    if (!isLumiverseWrapper(wrapper)) {
      throw new Error("lumiverse-preset: not a lumiverse_preset wrapper");
    }
    const stRaw = lumiverseToStRaw(wrapper);
    const parsed = parseStPreset(stRaw);
    const preset = wrapper.preset as Rec;
    const name = str(preset.name) ?? setNameFromFilename(input, "Imported preset");
    const body = parsedToBody(name, parsed);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: canonicalId(name),
      body,
      // the WRAPPER is the escrow twin (type/schemaVersion/preset.id and every unread key ride
      // whole); the ST-shaped conversion is deterministic, so emit rebuilds it instead of storing it
      original: { lumiverse: { raw: wrapper, unmapped: { dialect: parsed.dialect } } },
    };
  },

  fromCanonical(entity: CanonicalPreset): AdapterOutput {
    const wrapper = entity.original?.lumiverse?.raw;
    const twin = isLumiverseWrapper(wrapper) ? lumiverseToStRaw(wrapper) : undefined;
    const dialect = twin ? detectDialect((twin.prompts as Rec[]) ?? []) : "none";
    const out = buildStPreset(entity.body, twin, dialect);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default lumiversePreset;
