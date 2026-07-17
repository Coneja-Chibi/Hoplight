/**
 * Extension-map platforms - editor-lens coverage for hosts that ride the generic CCv2/v3
 * `extensions` bag (Lumiverse, Marinara, Chub) rather than shipping their own character adapter.
 * Thin hosts with no portable bag (Character.AI dropped, Crushon skipped, Janitor thin) are NOT
 * separate tabs: one **Default** CCv3 lens covers that interop shape. Pygmalion / legacy Backyard
 * JSON keep adapters but set `lens: false` (export honesty only; not strip tabs).
 * Merged into /api/coverage. Grounded in design/EXTENSIONS-CENSUS.md + platform-native-fields.md.
 */
import type { CoverageEntry } from "../../core/coverage";

export interface ExtensionPlatform extends CoverageEntry {
  /** platform-specific authored fields with no canonical home yet (ride original), named for honesty */
  originalFields?: string[];
}

/** Lens id for portable CCv3 body-only targeting (thin hosts / generic PNG). */
export const DEFAULT_CCV3_ID = "default-ccv3";

/** Retired per-host lens ids; prefs that still list these fold into DEFAULT_CCV3_ID. */
export const RETIRED_THIN_HOST_IDS = ["characterai", "crushon", "janitor"] as const;

const retiredThin = new Set<string>(RETIRED_THIN_HOST_IDS);

/**
 * Normalize saved lens prefs:
 * - characterai / crushon / janitor → Default
 * - backyard (legacy) → byaf (same product; modern archive is the strip target)
 * - pygmalion → dropped (export-only, no lens tab)
 * Order preserved; duplicates collapsed.
 */
export function migrateLensTargets(ids: readonly string[]): string[] {
  let needDefault = false;
  let needByaf = false;
  const out: string[] = [];
  for (const id of ids) {
    if (retiredThin.has(id)) {
      needDefault = true;
      continue;
    }
    if (id === "pygmalion") continue;
    if (id === "backyard") {
      needByaf = true;
      continue;
    }
    if (!out.includes(id)) out.push(id);
  }
  if (needByaf && !out.includes("byaf")) out.push("byaf");
  if (needDefault && !out.includes(DEFAULT_CCV3_ID)) out.push(DEFAULT_CCV3_ID);
  return out;
}

export const EXTENSION_PLATFORMS: ExtensionPlatform[] = [
  // Lumiverse: real adapter + coverage in formats/lumiverse/ (do not dual-list here).
  // Pygmalion / legacy Backyard: adapters with lens:false (export only).
  {
    id: "marinara",
    label: "Marinara",
    carries: [
      "identity.name", "identity.description", "identity.characterVersion", "persona.personality",
      "persona.scenario", "persona.appearance", "prompts.systemPrompt", "prompts.postHistoryInstructions",
      "prompts.depthInjections", "greetings.firstMessage", "greetings.alternateGreetings",
      "examples.exampleMessages", "discovery.tags", "attribution.creator", "attribution.creatorNotes",
      "presentation.palette", "media.portrait", "media.sprite",
      "settings.talkativeness", "worldName", "knowledgeRefs",
    ],
    originalFields: [
      "backstory", "rpgStats.enabled", "rpgStats.attributes[] (STR/DEX/...)", "rpgStats.hp {value,max}",
      // no pools in Marinara RPGStatsConfig (re-audit 2026-07-09)
      "avatarCrop", "trackerCardColors", "nameColor", "dialogueColor", "boxColor",
    ],
  },
  {
    id: "chub",
    label: "Chub",
    carries: [
      "identity.name", "identity.tagline", "identity.description", "persona.personality",
      "persona.scenario", "greetings.firstMessage", "greetings.alternateGreetings",
      "examples.exampleMessages", "discovery.tags", "attribution.creator", "attribution.publicNote",
      "media.portrait", "media.assets", "presentation.background", "prompts.depthInjections",
      "knowledgeRefs",
    ],
    originalFields: [
      "background_image",
      "related_lorebooks",
      "custom_css",
      "preset",
      "full_path",
      "id",
      "expressions",
      "alt_expressions",
      "extensions (Stages refs)",
    ],
  },
  // One tab for thin hosts (C.AI Tools dumps, Crushon drop-import, Janitor PNG, generic CCv3).
  // Read/write stays on formats/sillytavern. No fake extensions.<host> bag.
  {
    id: DEFAULT_CCV3_ID,
    label: "Default",
    carries: [
      "identity.name",
      "identity.description",
      "identity.characterVersion",
      "persona.personality",
      "persona.scenario",
      "greetings.firstMessage",
      "greetings.alternateGreetings",
      "examples.exampleMessages",
      "prompts.systemPrompt",
      "prompts.postHistoryInstructions",
      "attribution.creator",
      "attribution.creatorNotes",
      "discovery.tags",
      "media.portrait",
    ],
    notes: {
      "identity.name":
        "Portable CCv3 for thin hosts (Character.AI converters, Crushon import, Janitor PNG, generic cards). Export via SillyTavern path.",
    },
    originalFields: [],
  },
];
