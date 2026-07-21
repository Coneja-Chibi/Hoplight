/**
 * Cross-adapter detection firewall. With every format registered, each format's own sample must
 * route to exactly the right adapter, no collisions. This is the property that keeps the system
 * modular: adding a new format folder must not silently steal detection from an existing one.
 */
import { test, expect, beforeAll } from "bun:test";
import { registry, loadFormats, CANONICAL_SCHEMA_VERSION } from "./index";
import { zipSync, strToU8 } from "fflate";
import { readFileSync } from "node:fs";
import { join } from "node:path";

beforeAll(async () => {
  await loadFormats();
});

const asText = (o: unknown) => ({ text: JSON.stringify(o) });
const asCharx = (card: unknown) => ({ bytes: zipSync({ "card.json": strToU8(JSON.stringify(card)) }) });
const asByafSample = (): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dir, "../../samples/backyard/characters/1.byaf")));

interface Case {
  label: string;
  expected: string;
  input: { text?: string; bytes?: Uint8Array };
}

const CASES: Case[] = [
  {
    label: "plain CCv2 card -> sillytavern",
    expected: "sillytavern",
    input: asText({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "A", first_mes: "hi" } }),
  },
  {
    label: "CCv3 card WITH extensions.rolecall -> rolecall (outranks the generic ST reader)",
    expected: "rolecall",
    input: asText({ spec: "chara_card_v3", data: { name: "A", extensions: { rolecall: { id: "1" } } } }),
  },
  {
    label: ".charx zip -> risu",
    expected: "risu",
    input: asCharx({ spec: "chara_card_v3", data: { name: "A", extensions: {} } }),
  },
  {
    label: "native Agnai card -> agnai",
    expected: "agnai",
    input: asText({ kind: "character", persona: { kind: "text", attributes: { text: [""] } }, greeting: "hi" }),
  },
  {
    label: "Pygmalion flat JSON -> pygmalion (not ST v1)",
    expected: "pygmalion",
    input: asText({
      char_name: "Mira",
      char_persona: "quiet cartographer",
      char_greeting: "hi",
      world_scenario: "port city",
      example_dialogue: "{{user}}: a\n{{char}}: b",
    }),
  },
  {
    label: "Backyard legacy flat JSON -> backyard",
    expected: "backyard",
    input: asText({ aiName: "A", aiPersona: "x", customDialogue: "hi" }),
  },
  {
    label: "Backyard .byaf archive -> byaf",
    expected: "byaf",
    input: { bytes: asByafSample() },
  },
  {
    label: "legacy Backyard flat card -> backyard (does NOT collide with agnai's persona clause)",
    expected: "backyard",
    input: asText({ aiName: "A", aiPersona: "x" }),
  },
  {
    label: "ST worldbook -> sillytavern-lorebook (NOT a bare-name v1 character)",
    expected: "sillytavern-lorebook",
    input: asText({ entries: { "0": { key: ["x"], content: "y" } }, name: "World", scan_depth: 4 }),
  },
  {
    // scoped regex bundled INSIDE a real card belongs to the CHARACTER claim (the card wins on score)
    label: "spec'd card with data.extensions.regex_scripts -> sillytavern character, not regex",
    expected: "sillytavern",
    input: asText({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "A",
        first_mes: "hi",
        extensions: { regex_scripts: [{ scriptName: "s", findRegex: "/a/", replaceString: "b" }] },
      },
    }),
  },
  {
    label: "bare array of ST regex rows -> sillytavern-regex (the rows FILE home stays claimed)",
    expected: "sillytavern-regex",
    input: asText([{ scriptName: "s", findRegex: "/a/g", replaceString: "b", placement: [2] }]),
  },
  {
    // the bundling law: a preset CARRYING regex is a PRESET (its bundle surfaces as a related set)
    label: "RoleCall/ST preset export with bundled regex -> sillytavern-preset, never a regex set",
    expected: "sillytavern-preset",
    input: asText({
      temperature: 0.9,
      top_p: 1,
      impersonation_prompt: "x",
      prompts: [{ identifier: "main", name: "Main", system_prompt: true, content: "..." }],
      prompt_order: [{ character_id: 100001, order: [] }],
      extensions: {
        regex_scripts: [
          { id: "1", scriptName: "Fix quotes", findRegex: "/a/g", replaceString: "b", placement: [2], disabled: false },
        ],
        linkedRegexScripts: [{ id: "1", name: "Fix quotes", description: "", rules: [] }],
      },
    }),
  },
  {
    label: "lumiverse_preset wrapper -> lumiverse-preset (never the ST preset codec)",
    expected: "lumiverse-preset",
    input: asText({
      type: "lumiverse_preset",
      schemaVersion: 2,
      preset: { id: "x", name: "Wrapped", blocks: [], samplerOverrides: { temperature: 1 } },
    }),
  },
  {
    label: "plain ST chat-completion preset -> sillytavern-preset",
    expected: "sillytavern-preset",
    input: asText({
      name: "Paramnesia-like preset",
      extensions: {},
      chat_completion_source: "openai",
      temperature: 0.9,
      top_p: 1,
      impersonation_prompt: "x",
      prompts: [{ identifier: "main", name: "Main", system_prompt: true, content: "..." }],
      prompt_order: [{ character_id: 100001, order: [] }],
    }),
  },
  {
    label: "RC v1 lorebook export -> rolecall-lorebook",
    expected: "rolecall-lorebook",
    input: asText({ schemaVersion: "1.0.0", exportDate: "2026-01-01", lorebook: { name: "W", entries: [] } }),
  },
  {
    label: "our own canonical json -> vaud-json",
    expected: "vaud-json",
    input: asText({
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "character",
      id: "a",
      body: {
        identity: { name: "A" },
        persona: {},
        prompts: {},
        greetings: {},
        examples: {},
        media: {},
        attribution: {},
        discovery: {},
      },
    }),
  },
];

for (const c of CASES) {
  test(`routes: ${c.label}`, () => {
    expect(registry.detect(c.input)?.id).toBe(c.expected);
  });
}

/**
 * The cross-KIND firewall, adversarial half: real settings artifacts users WILL drop (they sit in
 * the same export menus as cards) that no adapter supports today. Detection must claim NOTHING -
 * a wrong claim imports garbage under a wrong kind, which shipped once (a SillyTavern chat
 * completion preset read as a flat character card because it carries `name` + `extensions`).
 */
const FOREIGN: Case[] = [
  {
    label: "ST instruct template (name + system_prompt string + sequences) is NOT a character",
    expected: "nobody",
    input: asText({
      name: "Some Instruct",
      system_prompt: "You are {{char}}.",
      input_sequence: "<|user|>",
      output_sequence: "<|assistant|>",
      stop_sequence: "",
      wrap: false,
    }),
  },
  {
    label: "ST context template (name + story_string) is NOT a character",
    expected: "nobody",
    input: asText({
      name: "Some Context",
      story_string: "{{#if system}}{{system}}{{/if}}",
      chat_start: "***",
      example_separator: "***",
    }),
  },
  {
    label: "bare name+extensions blob is NOT a character",
    expected: "nobody",
    input: asText({ name: "Just a name", extensions: {} }),
  },
  {
    label: "a notes blob with a string persona and no story fields is NOT a Backyard card",
    expected: "nobody",
    input: asText({ name: "My notes", persona: "I write long journal entries." }),
  },
  {
    label: "textgen sampler grid (no name, all numbers) is NOT anything",
    expected: "nobody",
    input: asText({ temp: 0.7, top_p: 0.9, top_k: 40, rep_pen: 1.1, rep_pen_range: 1024 }),
  },
  {
    label: "RoleCall library wrapper (exportedAt/type/version/data) is NOT its inner kind",
    expected: "nobody",
    input: asText({
      exportedAt: "2026-07-21T00:00:00.000Z",
      type: "preset",
      version: "1.0",
      data: { temperature: 1, prompts: [], prompt_order: [] },
    }),
  },
];

for (const c of FOREIGN) {
  test(`refuses: ${c.label}`, () => {
    expect(registry.detect(c.input)?.id).toBeUndefined();
  });
}

/**
 * The positive half, run over EVERY committed sample: the file's folder names its family and kind
 * (samples/<family>/<kinddir>/...), and detection must land inside that family (or a listed
 * generic reader) with exactly that kind. Grows with the sample tree; a new format drops samples
 * in and is covered.
 */
import { readdirSync, statSync } from "node:fs";

const SAMPLES_ROOT = join(import.meta.dir, "../../samples");
type AdapterKind = "character" | "lorebook" | "persona" | "preset" | "regex";
const KIND_BY_DIR: Record<string, AdapterKind> = {
  characters: "character",
  lorebooks: "lorebook",
  personas: "persona",
  presets: "preset",
  regex: "regex",
};
// Bare CC cards and standalone character_books legitimately route to the generic Tavern readers.
const FAMILY_ALLOW: Record<string, string[]> = {
  chub: ["sillytavern"],
  risu: ["risu", "sillytavern"],
  lumiverse: ["lumiverse", "sillytavern"],
  backyard: ["backyard", "byaf"],
  agnai: ["agnai", "sillytavern"], // its samples include generic character_book downloads
};

function sampleInputs(): { family: string; kind: AdapterKind; file: string; input: Case["input"] }[] {
  const out: { family: string; kind: AdapterKind; file: string; input: Case["input"] }[] = [];
  for (const family of readdirSync(SAMPLES_ROOT)) {
    const famDir = join(SAMPLES_ROOT, family);
    if (!statSync(famDir).isDirectory()) continue;
    for (const kindDir of readdirSync(famDir)) {
      const kind = KIND_BY_DIR[kindDir];
      if (!kind) continue;
      for (const file of readdirSync(join(famDir, kindDir))) {
        if (file.endsWith(".md")) continue;
        const bytes = new Uint8Array(readFileSync(join(famDir, kindDir, file)));
        // mirror the server's toAdapterInput: bytes always, text when it decodes as clean UTF-8
        let text: string | undefined;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          text = undefined;
        }
        out.push({ family, kind, file, input: text !== undefined ? { text, bytes } : { bytes } });
      }
    }
  }
  return out;
}

// Known-undetected samples, kept visible instead of silently skipped: committed for a planned
// import path that does not exist yet. Shrink this list, never grow it quietly.
const KNOWN_GAPS = new Set([
  // Forensically examined 2026-07-21: this file carries NO payload anywhere (no tEXt/iTXt/zTXt
  // chunks, no alpha/RGB LSB steganography, no post-IEND tail - the alpha channel is a plain
  // rounded-corner fade). It is a re-encoded copy that lost its embedded data. A png lorebook
  // path needs a REAL NovelAI export to spec against; building one from this file would be invention.
  "novelai/sigurdcard-embedded-lorebook.png",
]);

for (const s of sampleInputs()) {
  const label = `${s.family}/${s.file}`;
  if (KNOWN_GAPS.has(label)) {
    test(`samples KNOWN GAP (no adapter yet): ${label}`, () => {
      expect(registry.detect(s.input)).toBeUndefined(); // the day an adapter claims it, promote it
    });
    continue;
  }
  test(
    `samples: ${label} detects as a ${s.kind} in its own family`,
    () => {
      const adapter = registry.detect(s.input);
      expect(adapter, "no adapter claimed this committed sample").toBeDefined();
      expect(adapter!.kind).toBe(s.kind);
      const allowed = FAMILY_ALLOW[s.family] ?? [s.family];
      const familyOf = adapter!.id.split("-")[0]!;
      expect(allowed).toContain(familyOf);
    },
    30000, // a 23MB charx makes sixteen adapters each decode the bytes; well past bun's 5s default
  );
}

test("every registered adapter declares at least one output extension (drop-in contract)", () => {
  const adapters = registry.all();
  expect(adapters.length).toBeGreaterThanOrEqual(6);
  for (const a of adapters) expect(a.outputExtensions.length).toBeGreaterThan(0);
});
