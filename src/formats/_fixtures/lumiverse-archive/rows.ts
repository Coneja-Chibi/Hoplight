/**
 * Synthetic SQLite rows for .lvbak fixtures, one builder per table the importer maps
 * (specs/formats/lumiverse-archive.md Behavior step 5). Column names are Lumiverse's live column
 * names; values are obviously fake ("Test Character Alpha"), never copied from a real export.
 *
 * Two properties of a SQLite dump are reproduced deliberately, because the importer has to survive
 * both and a prettier fixture would hide them:
 *
 * 1. Every array or object column arrives as a STRING holding JSON, and needs a second parse. The
 *    spec verifies that for extensions, prompts, prompt_order, parameters, placement, target,
 *    actions, metadata, and key; the same is true of every other array column here (tags,
 *    alternate_greetings, keysecondary, trim_strings) because SQLite has no array type.
 * 2. Booleans are 0 and 1 integers, not true and false, so row to wire synthesis has to coerce.
 */

/** One dumped row. Values are whatever SQLite held: string, number, or null. */
export type LvbakRow = Record<string, unknown>;

/** Frozen epoch milliseconds for 2026-01-01T00:00:00Z, so a rebuild is byte-stable. */
export const FIXED_TS = 1767225600000;

export const CHARACTER_ID = "lv-char-000000000001";
export const WORLD_BOOK_ID = "lv-book-000000000001";
export const PRESET_ID = "lv-preset-000000000001";
export const PERSONA_ID = "lv-persona-000000000001";
export const REGEX_ID = "lv-regex-000000000001";
export const IMAGE_ID = "lv-image-000000000001";

/** A primary key no row in any fixture carries, for pinning dangling-link behavior. */
export const DANGLING_ID = "lv-missing-999999999999";

export const CHARACTER_AVATAR = "test-character-alpha.png";
export const PERSONA_AVATAR = "test-persona-alpha.png";
export const IMAGE_FILENAME = "test-image-alpha.png";

const json = (v: unknown): string => JSON.stringify(v);

/**
 * The extensions blob the character adapter's modules path already reads: expression sprites,
 * expression groups, alternate fields, embedded regex, an embedded character_book, and one foreign
 * platform key that exists only to prove escrow keeps what we do not map.
 *
 * `expressions.mappings` and `alternate_fields` are shaped to match LumiModules
 * (src/formats/lumiverse/modules.ts) exactly, not guessed: rehydrateCardData's own type guards
 * (`isRec`, which excludes arrays) reject anything else, so an array in either slot would silently
 * no-op rather than resolve. `expression_groups` still carries its pre-M5 array shape and still
 * no-ops the same way; fixing it is out of scope here (nothing in the lvbak importer's required
 * behavior depends on it), left as a known gap rather than a guess at its real shape.
 */
export const characterExtensions = (): Record<string, unknown> => ({
  lumiverse_modules: {
    expressions: {
      enabled: true,
      defaultExpression: "neutral",
      mappings: {
        neutral: "files/expressions/neutral.png",
        happy: "files/expressions/happy.png",
      },
    },
    expression_groups: [{ id: "grp-alpha", label: "Default", members: ["neutral", "happy"] }],
    alternate_fields: {
      Formal: { first_mes: "Good day. I am Test Character Alpha." },
    },
    regex_scripts: [
      {
        name: "Embedded Fixture Trim",
        find_regex: "\\s+$",
        replace_string: "",
        flags: "gm",
        placement: ["ai_output"],
        scope_id: null,
        target: "display",
        min_depth: null,
        max_depth: null,
        trim_strings: [],
        run_on_edit: false,
        substitute_macros: "none",
        disabled: false,
        sort_order: 0,
        description: "Synthetic embedded rule.",
      },
    ],
  },
  character_book: {
    name: "Test Character Alpha Embedded Book",
    entries: [
      {
        keys: ["alpha"],
        content: "Embedded lore that rides inside the fixture card.",
        enabled: true,
        insertion_order: 0,
      },
    ],
  },
  chub: { preset: "fixture-escrow-only" },
});

export const characterRow = (over: LvbakRow = {}): LvbakRow => ({
  id: CHARACTER_ID,
  name: "Test Character Alpha",
  description: "A synthetic character that exists only inside the Hoplight test suite.",
  first_mes: "Greetings. I am Test Character Alpha.",
  mes_example: "<START>\n{{user}}: Hello.\n{{char}}: Hello back.",
  personality: "Precise, fictional, unbothered.",
  scenario: "A fixture bench inside a test suite.",
  system_prompt: "Stay in character as Test Character Alpha.",
  post_history_instructions: "Keep replies short.",
  alternate_greetings: json(["A second synthetic greeting."]),
  creator: "Hoplight Fixtures",
  creator_notes: "Synthetic data. Never a real user export.",
  tags: json(["fixture", "synthetic"]),
  extensions: json(characterExtensions()),
  avatar_path: CHARACTER_AVATAR,
  image_id: IMAGE_ID,
  avatar_crop_image_id: null,
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

export const worldBookRow = (over: LvbakRow = {}): LvbakRow => ({
  id: WORLD_BOOK_ID,
  name: "Test World Book Alpha",
  description: "A synthetic lorebook for fixture use.",
  metadata: json({ source: "fixture", tags: ["synthetic"] }),
  vectorized: 0,
  vector_index_status: "none",
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

export const worldBookEntryRow = (over: LvbakRow = {}): LvbakRow => ({
  id: "lv-entry-000000000001",
  world_book_id: WORLD_BOOK_ID,
  key: json(["alpha", "test alpha"]),
  keysecondary: json(["fixture"]),
  content: "Alpha is a placeholder concept invented for this fixture.",
  comment: "Fixture entry",
  selective: 1,
  selective_logic: 0,
  constant: 0,
  position: 0,
  depth: 4,
  order_value: 100,
  probability: 100,
  scan_depth: 2,
  sticky: 0,
  cooldown: 0,
  delay: 0,
  use_regex: 0,
  disable: 0,
  vectorized: 0,
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

/**
 * The preset ROW, which is the wrapper's inner block model and not the wrapper itself: prompts is
 * an object keyed by identifier, prompt_order is an array of whole prompt objects. Turning this
 * into the {type: "lumiverse_preset", preset: {...}} file the codec parses is the preset slice's
 * declared build-time task, not an identity copy.
 */
export const presetRow = (over: LvbakRow = {}): LvbakRow => ({
  id: PRESET_ID,
  name: "Test Preset Alpha",
  description: "A synthetic preset for fixture use.",
  prompts: json({
    "blk-main": {
      identifier: "blk-main",
      name: "Main",
      role: "system",
      content: "You are running a fixture scene.",
      enabled: true,
    },
    "blk-post-history": {
      identifier: "blk-post-history",
      name: "Post History",
      role: "system",
      content: "Stay inside the fixture.",
      enabled: true,
    },
  }),
  prompt_order: json([
    {
      identifier: "blk-main",
      enabled: true,
      position: "pre_history",
      depth: 0,
      role: "system",
      injectionTrigger: [],
    },
    {
      identifier: "blk-post-history",
      enabled: true,
      position: "depth",
      depth: 4,
      role: "system",
      injectionTrigger: ["normal"],
    },
  ]),
  parameters: json({
    customBody: { top_k: 40 },
    samplerOverrides: { temperature: 0.85, topP: 0.92, maxTokens: 512 },
  }),
  provider: "openai-compatible",
  engine: "chat-completions",
  metadata: json({ source: "fixture" }),
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

export const personaRow = (over: LvbakRow = {}): LvbakRow => ({
  id: PERSONA_ID,
  name: "Test Persona Alpha",
  title: "Fixture Operator",
  description: "A synthetic persona that exists only inside the Hoplight test suite.",
  subjective_pronoun: "they",
  objective_pronoun: "them",
  possessive_pronoun: "their",
  is_narrator: 0,
  is_default: 1,
  avatar_path: PERSONA_AVATAR,
  attached_world_book_id: null,
  folder: null,
  metadata: json({ source: "fixture" }),
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

export const regexScriptRow = (over: LvbakRow = {}): LvbakRow => ({
  id: REGEX_ID,
  name: "Test Regex Alpha",
  script_id: "rx-alpha",
  find_regex: "fixture",
  replace_string: "FIXTURE",
  actions: json([{ type: "replace", label: "Shout the word" }]),
  flags: "gi",
  placement: json(["user_input", "ai_output"]),
  scope: "account",
  scope_id: null,
  target: json(["prompt", "display"]),
  min_depth: null,
  max_depth: null,
  trim_strings: json([]),
  run_on_edit: 0,
  substitute_macros: "none",
  disabled: 0,
  sort_order: 0,
  description: "A synthetic regex rule for fixture use.",
  folder: null,
  pack_id: null,
  preset_id: null,
  character_id: null,
  metadata: json({ source: "fixture" }),
  created_at: FIXED_TS,
  updated_at: FIXED_TS,
  ...over,
});

export const imageRow = (over: LvbakRow = {}): LvbakRow => ({
  id: IMAGE_ID,
  filename: IMAGE_FILENAME,
  character_id: CHARACTER_ID,
  width: 1,
  height: 1,
  mime_type: "image/png",
  created_at: FIXED_TS,
  ...over,
});
