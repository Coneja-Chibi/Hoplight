/**
 * RoleCall tracker-module seed schemas - DATA, one per immersion module, driving the no-code
 * starting-value forms. Fields are RoleCall's real shapes (stores/immersion: initialize.ts
 * TrackerInitializationData + types.ts NPCRelationship/Quest/PartyMember/KnowledgeEntry/
 * ParallelEvent/MapLocation, resources.ts PlayerResources, battle enemies, corruption stats).
 * Rendered by TrackerSetup with FieldForm (value-set) / ListEditor (list) / composite (top + list).
 */
import type { FormField } from "../field-form";

/** how a module's initial state is seeded */
export type SeedSchema =
  | { kind: "fields"; fields: FormField[] } // initialState[key] is an object of values
  | { kind: "list"; itemFields: FormField[]; titleKey?: string; addLabel?: string } // ...is an array
  | { kind: "composite"; topFields?: FormField[]; listKey: string; itemFields: FormField[]; titleKey?: string; addLabel?: string };

export interface TrackerModule {
  /** ImmersionModuleId + the initialState key (same string) */
  id: string;
  label: string;
  description: string;
  seed: SeedSchema;
}

const num = (key: string, label: string, extra?: Partial<FormField>): FormField => ({ key, label, kind: "number", half: true, ...extra });
const stat = (key: string, label: string): FormField => ({ key, label, kind: "slider", min: 0, max: 100 });
const txt = (key: string, label: string, extra?: Partial<FormField>): FormField => ({ key, label, kind: "text", ...extra });
const sel = (key: string, label: string, options: string[]): FormField => ({
  key,
  label,
  kind: "select",
  options: options.map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) })),
});

export const TRACKER_MODULES: readonly TrackerModule[] = [
  {
    id: "resources",
    label: "Resources",
    description: "HP, MP, AP, shield, XP, level, currency.",
    seed: {
      kind: "fields",
      fields: [
        num("hp", "HP"), num("maxHp", "Max HP"),
        num("mp", "MP"), num("maxMp", "Max MP"),
        num("ap", "AP"), num("maxAp", "Max AP"),
        num("shield", "Shield"), num("xp", "XP"),
        num("level", "Level"), num("currency", "Currency"),
      ],
    },
  },
  {
    id: "corruption",
    label: "Corruption",
    description: "Corruption, submission, dependence, obsession, identity loss.",
    seed: {
      kind: "fields",
      fields: [stat("corruption", "Corruption"), stat("submission", "Submission"), stat("dependence", "Dependence"), stat("obsession", "Obsession"), stat("identityLoss", "Identity loss")],
    },
  },
  {
    id: "relationships",
    label: "Relationships",
    description: "NPCs the player already knows.",
    seed: {
      kind: "list",
      titleKey: "npcName",
      addLabel: "+ add an NPC",
      itemFields: [
        txt("npcName", "Name"),
        sel("category", "Category", ["stranger", "acquaintance", "friend", "lover", "rival", "family", "enemy"]),
        stat("affinity", "Affinity"),
        stat("trustLevel", "Trust"),
      ],
    },
  },
  {
    id: "quests",
    label: "Quests",
    description: "Quests the player starts with.",
    seed: {
      kind: "list",
      titleKey: "title",
      addLabel: "+ add a quest",
      itemFields: [
        txt("title", "Title"),
        sel("type", "Type", ["main", "side", "hidden", "urgent", "daily", "event"]),
        sel("status", "Status", ["active", "completed", "failed", "abandoned"]),
        { key: "description", label: "Description / first objective", kind: "textarea" },
      ],
    },
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Items and currency the player starts with.",
    seed: {
      kind: "composite",
      topFields: [num("currency", "Currency")],
      listKey: "items",
      titleKey: "name",
      addLabel: "+ add an item",
      itemFields: [txt("name", "Name"), num("quantity", "Qty"), sel("rarity", "Rarity", ["common", "uncommon", "rare", "epic", "legendary"])],
    },
  },
  {
    id: "party",
    label: "Party",
    description: "Companions the player travels with.",
    seed: {
      kind: "composite",
      topFields: [txt("name", "Party name")],
      listKey: "members",
      titleKey: "name",
      addLabel: "+ add a member",
      itemFields: [
        txt("name", "Name"),
        sel("combatRole", "Role", ["tank", "healer", "dps", "support", "hybrid"]),
        num("level", "Level"), num("hp", "HP"), num("maxHp", "Max HP"), num("mp", "MP"), num("maxMp", "Max MP"),
      ],
    },
  },
  {
    id: "knowledge",
    label: "Knowledge",
    description: "What the player already knows.",
    seed: {
      kind: "list",
      titleKey: "subject",
      addLabel: "+ add an entry",
      itemFields: [
        txt("subject", "Subject"),
        { key: "content", label: "Content", kind: "textarea" },
        sel("category", "Category", ["person", "place", "event", "secret", "lore", "rumor", "fact"]),
        sel("reliability", "Reliability", ["confirmed", "likely", "unverified", "false"]),
      ],
    },
  },
  {
    id: "parallelEvents",
    label: "Parallel Events",
    description: "Off-screen events already in motion.",
    seed: {
      kind: "list",
      titleKey: "title",
      addLabel: "+ add an event",
      itemFields: [
        txt("title", "Title"),
        { key: "description", label: "Description", kind: "textarea" },
        txt("locationName", "Where", { half: true }),
        txt("estimatedDuration", "Duration", { half: true, placeholder: "until nightfall" }),
      ],
    },
  },
  {
    id: "bonds",
    label: "Bonds",
    description: "Supernatural bonds, vows, blood links.",
    seed: {
      kind: "list",
      titleKey: "name",
      addLabel: "+ add a bond",
      itemFields: [txt("name", "Name"), txt("type", "Type", { half: true }), { key: "description", label: "Effect", kind: "textarea" }],
    },
  },
  {
    id: "battle",
    label: "Battle",
    description: "Start already in combat, with enemies.",
    seed: {
      kind: "composite",
      topFields: [{ key: "inCombat", label: "In combat", kind: "toggle" }],
      listKey: "enemies",
      titleKey: "name",
      addLabel: "+ add an enemy",
      itemFields: [
        txt("name", "Name"),
        num("hp", "HP"), num("maxHp", "Max HP"), num("level", "Level"),
        { key: "isBoss", label: "Boss", kind: "toggle", half: true },
        sel("threat", "Threat", ["low", "medium", "high", "critical"]),
      ],
    },
  },
  {
    id: "map",
    label: "Map",
    description: "Where the story opens and known places.",
    seed: {
      kind: "composite",
      listKey: "locations",
      titleKey: "name",
      addLabel: "+ add a location",
      itemFields: [txt("name", "Name"), txt("type", "Type", { half: true }), { key: "description", label: "Description", kind: "textarea" }],
    },
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "The story's starting date and events.",
    seed: {
      kind: "list",
      titleKey: "title",
      addLabel: "+ add an event",
      itemFields: [txt("title", "Event"), txt("date", "Date", { half: true }), { key: "description", label: "Description", kind: "textarea" }],
    },
  },
  {
    id: "gossip",
    label: "Gossip",
    description: "Rumors already circulating.",
    seed: {
      kind: "list",
      titleKey: "subject",
      addLabel: "+ add a rumor",
      itemFields: [txt("subject", "Subject"), { key: "content", label: "Rumor", kind: "textarea" }],
    },
  },
  {
    id: "memoryJournal",
    label: "Memory Journal",
    description: "Moments an NPC already remembers.",
    seed: {
      kind: "list",
      titleKey: "npcName",
      addLabel: "+ add a memory",
      itemFields: [txt("npcName", "NPC"), { key: "content", label: "Memory", kind: "textarea" }],
    },
  },
  {
    id: "spellbook",
    label: "Spellbook",
    description: "Spells the player already knows.",
    seed: {
      kind: "list",
      titleKey: "name",
      addLabel: "+ add a spell",
      itemFields: [txt("name", "Name"), { key: "description", label: "Effect", kind: "textarea" }, num("charges", "Charges")],
    },
  },
  {
    id: "creatureCodex",
    label: "Creature Codex",
    description: "Species already catalogued.",
    seed: {
      kind: "composite",
      listKey: "species",
      titleKey: "name",
      addLabel: "+ add a species",
      itemFields: [txt("name", "Name"), { key: "description", label: "Description", kind: "textarea" }],
    },
  },
  {
    id: "biologicalCycles",
    label: "Biological Cycles",
    description: "Cycles and their starting phase.",
    seed: {
      kind: "list",
      titleKey: "name",
      addLabel: "+ add a cycle",
      itemFields: [txt("name", "Name"), txt("phase", "Current phase", { half: true }), num("day", "Day", { half: true })],
    },
  },
];

/** the world themes RoleCall offers */
export const WORLD_THEMES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "fantasy", label: "Fantasy" },
  { value: "scifi", label: "Sci-Fi" },
  { value: "modern", label: "Modern" },
  { value: "horror", label: "Horror" },
  { value: "postapo", label: "Post-Apoc" },
];
