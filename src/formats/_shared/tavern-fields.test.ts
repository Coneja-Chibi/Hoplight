/**
 * applyBodyToData three-state overlay: unchanged / changed / cleared vs the twin.
 */
import { expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import { applyBodyToData, dataToBody, type TavernData } from "./tavern-fields";

const populated: TavernData = {
  name: "Alice",
  description: "curious",
  personality: "bright",
  scenario: "wonderland",
  first_mes: "Hello!",
  mes_example: "<START>",
  system_prompt: "be Alice",
  post_history_instructions: "stay in scene",
  creator_notes: "test card",
  tags: ["fantasy", "lit"],
  creator: "ada",
  character_version: "1.0",
  alternate_greetings: ["Hi again", "Oh?"],
  group_only_greetings: ["Evening, all."],
  nickname: "Al",
  source: ["https://example.com/alice"],
  creation_date: 1700000000,
  modification_date: 1700000001,
  creator_notes_multilingual: { en: "hi" },
  extensions: {
    talkativeness: "0.5",
    world: "Eldoria",
    depth_prompt: { prompt: "stay in character", depth: 4, role: "system" },
    foreign_bag: { keep: true },
  },
  character_book: { name: "book", entries: [] },
};

const bodyOf = (d: TavernData): CharacterBody => dataToBody(d);

test("untouched mapped fields leave raw bytes/shape identical", () => {
  const base = structuredClone(populated);
  const out = applyBodyToData(base, bodyOf(populated));
  expect(out).toEqual(populated);
  // unknown / non-mapped twin residue survives
  expect(out.extensions).toEqual(populated.extensions);
  expect(out.character_book).toEqual(populated.character_book);
});

test("changed scalar and list values write through", () => {
  const base = structuredClone(populated);
  const b = bodyOf(populated);
  b.identity.description = "edited desc";
  b.persona.personality = "edited pers";
  b.discovery.tags = ["new"];
  b.greetings.alternateGreetings = [{ text: "only one" }];
  b.settings = { talkativeness: 0.9 };
  b.worldName = "Narnia";
  const inj = b.prompts.depthInjections![0]!;
  inj.text = "never break";
  inj.depth = 6;

  const out = applyBodyToData(base, b);
  expect(out.description).toBe("edited desc");
  expect(out.personality).toBe("edited pers");
  expect(out.tags).toEqual(["new"]);
  expect(out.alternate_greetings).toEqual(["only one"]);
  expect(out.extensions?.talkativeness).toBe(0.9);
  expect(out.extensions?.world).toBe("Narnia");
  expect(out.extensions?.depth_prompt).toEqual({
    prompt: "never break",
    depth: 6,
    role: "system",
  });
  // sibling extension residue untouched
  expect(out.extensions?.foreign_bag).toEqual({ keep: true });
});

test("cleared mapped scalars write empty string; lists write []; optional nums delete", () => {
  const base = structuredClone(populated);
  const b = bodyOf(populated);
  // editor delete-on-empty: leave keys absent
  delete (b.identity as { description?: string }).description;
  delete (b.persona as { personality?: string }).personality;
  delete (b.persona as { scenario?: string }).scenario;
  delete (b.greetings as { firstMessage?: string }).firstMessage;
  delete (b.examples as { exampleMessages?: string }).exampleMessages;
  delete (b.prompts as { systemPrompt?: string }).systemPrompt;
  delete (b.prompts as { postHistoryInstructions?: string }).postHistoryInstructions;
  delete (b.attribution as { creatorNotes?: string }).creatorNotes;
  delete (b.attribution as { creator?: string }).creator;
  delete (b.identity as { characterVersion?: string }).characterVersion;
  delete (b.identity as { nickname?: string }).nickname;
  delete (b.discovery as { tags?: string[] }).tags;
  delete (b.greetings as { alternateGreetings?: unknown }).alternateGreetings;
  delete (b.greetings as { groupOnlyGreetings?: unknown }).groupOnlyGreetings;
  delete (b.attribution as { source?: string[] }).source;
  delete (b.attribution as { createdAt?: number }).createdAt;
  delete (b.attribution as { updatedAt?: number }).updatedAt;
  delete (b.attribution as { creatorNotesMultilingual?: unknown }).creatorNotesMultilingual;
  b.settings = undefined;
  b.worldName = undefined;
  b.prompts.depthInjections = undefined;

  const out = applyBodyToData(base, b);
  expect(out.description).toBe("");
  expect(out.personality).toBe("");
  expect(out.scenario).toBe("");
  expect(out.first_mes).toBe("");
  expect(out.mes_example).toBe("");
  expect(out.system_prompt).toBe("");
  expect(out.post_history_instructions).toBe("");
  expect(out.creator_notes).toBe("");
  expect(out.creator).toBe("");
  expect(out.character_version).toBe("");
  expect(out.nickname).toBe("");
  expect(out.tags).toEqual([]);
  expect(out.alternate_greetings).toEqual([]);
  expect(out.group_only_greetings).toEqual([]);
  expect(out.source).toEqual([]);
  expect("creation_date" in out).toBe(false);
  expect("modification_date" in out).toBe(false);
  expect("creator_notes_multilingual" in out).toBe(false);
  // first-class extension keys deleted; siblings retained
  expect("talkativeness" in (out.extensions ?? {})).toBe(false);
  expect("world" in (out.extensions ?? {})).toBe(false);
  expect("depth_prompt" in (out.extensions ?? {})).toBe(false);
  expect(out.extensions?.foreign_bag).toEqual({ keep: true });
  expect(out.character_book).toEqual(populated.character_book);
});

test("unsupported raw source object survives when canonical never represented it", () => {
  const base: TavernData = {
    name: "Vera",
    description: "cartographer",
    // RoleCall-style nonstandard source OBJECTS: toStrings filters to [] (no strings)
    source: [{ name: "rolecall" }] as unknown as string[],
    extensions: { foreign: 1 },
  };
  const b = bodyOf(base);
  // decoded as empty list (not a representable string source); treat like both-absent
  expect(b.attribution.source).toEqual([]);
  const out = applyBodyToData(base, b);
  expect(out.source as unknown).toEqual([{ name: "rolecall" }]);
  expect(out.extensions).toEqual({ foreign: 1 });
});

test("empty ST depth_prompt default is left alone when never authored", () => {
  const base: TavernData = {
    name: "Seraphina",
    extensions: {
      talkativeness: "0.5",
      world: "Eldoria",
      depth_prompt: { prompt: "", depth: 4, role: "system" },
    },
  };
  const b = bodyOf(base);
  expect(b.prompts.depthInjections).toBeUndefined();
  const out = applyBodyToData(structuredClone(base), b);
  expect(out.extensions?.depth_prompt).toEqual({ prompt: "", depth: 4, role: "system" });
  expect(out.extensions?.talkativeness).toBe("0.5");
  expect(out.extensions?.world).toBe("Eldoria");
});
