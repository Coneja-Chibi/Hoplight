/** Regression coverage for the convert.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import { unzipSync, strFromU8 } from "fflate";
import { join } from "node:path";
import {
  CANONICAL_SCHEMA_VERSION,
  loadFormats,
  registry,
  type AdapterOutput,
  type FormatAdapter,
} from "./core";
import { emptyLorebookBody } from "./core/lore";
import type { ParsedCanonicalEntity } from "./entities/runtime-schema";
import { convertFile, emitBundle, inspectBundle, rewriteKnowledgeRefs } from "./convert";
import { characterAdapter as stCharacter } from "./formats/sillytavern/index";
import { characterAdapter as rcCharacter } from "./formats/rolecall/index";
import { characterAdapter as risuCharacter } from "./formats/risu/index";
import stWorldbook from "./formats/sillytavern/lorebook";
import rcLorebook from "./formats/rolecall/lorebook";

/** A CCv3 card carrying an embedded character_book (one entry, raw-only residue). */
function makeCardWithBook() {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Aria",
      description: "a skyport navigator",
      character_book: {
        name: "Aetheria Lore",
        scan_depth: 5,
        entries: [
          {
            id: 0,
            name: "The Skyports",
            content: "Floating docks ring every island.",
            keys: ["skyport"],
            insertion_order: 10,
            position: "before_char",
            enabled: true,
            extensions: { role: 0, vectorized: true },
          },
        ],
      },
    },
  };
}

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

function minimalEntity(kind: FormatAdapter["kind"]): ParsedCanonicalEntity {
  const envelope = { schemaVersion: CANONICAL_SCHEMA_VERSION, id: `conversion-${kind}` };
  switch (kind) {
    case "character":
      return {
        ...envelope,
        kind,
        body: {
          identity: { name: "Conversion character" },
          persona: {},
          prompts: {},
          greetings: {},
          examples: {},
          media: {},
          attribution: {},
          discovery: {},
        },
      };
    case "lorebook":
      return { ...envelope, kind, body: emptyLorebookBody("Conversion lorebook") };
    case "persona":
      return { ...envelope, kind, body: { name: "Conversion persona", content: "" } };
    case "preset":
      return { ...envelope, kind, body: { name: "Conversion preset", prompts: [] } };
    case "regex":
      return {
        ...envelope,
        kind,
        body: {
          name: "Conversion regex",
          rules: [{
            id: "conversion-rule",
            label: "Conversion rule",
            find: "before",
            flags: "g",
            replace: "after",
            phases: ["output"],
            enabled: true,
            sortOrder: 0,
          }],
        },
      };
  }
}

test("convertCard carries an embedded lorebook across the boundary (extract -> link -> re-embed)", () => {
  const card = makeCardWithBook();
  const { out, lorebooks } = convertFile(stCharacter, stCharacter, asText(card));

  // the embedded book was extracted and linked as a standalone canonical lorebook
  expect(lorebooks).toHaveLength(1);
  expect(lorebooks[0]!.body.name).toBe("Aetheria Lore");
  expect(lorebooks[0]!.id).toBe("aetheria-lore");

  // and it survives, byte-identical, in the target card's own character_book slot
  const back = JSON.parse(out.text ?? "");
  expect(back.data.character_book).toEqual(card.data.character_book);
  expect(back.data.character_book.entries[0].extensions.vectorized).toBe(true);
});

test("convertFile on a book-less card links nothing and writes no character_book", () => {
  const bare = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Bob", description: "x" } };
  const { out, lorebooks } = convertFile(stCharacter, stCharacter, asText(bare));
  expect(lorebooks).toHaveLength(0);
  const back = JSON.parse(out.text ?? "");
  expect(back.data.character_book).toBeUndefined();
});

test("convertFile routes a standalone lorebook file (ST worldbook -> RC v1) same-kind", () => {
  const worldbook = {
    entries: {
      "0": { uid: 0, comment: "Skyports", content: "Floating docks.", key: ["skyport"], position: 2, order: 100 },
    },
    name: "Aetheria",
    scan_depth: 4,
  };
  const { out, lorebooks } = convertFile(stWorldbook, rcLorebook, asText(worldbook));
  expect(lorebooks).toHaveLength(0); // lorebook conversions do not extract sub-entities
  const rc = JSON.parse(out.text ?? "");
  expect(rc.schemaVersion).toBe("1.0.0");
  expect(rc.lorebook.name).toBe("Aetheria");
  expect(rc.lorebook.entries[0].title).toBe("Skyports");
  expect(rc.lorebook.entries[0].injection.position).toBe("before_example");
});

test("cross-format: an ST card with a book converts to a RoleCall card with the book intact", () => {
  const { out } = convertFile(stCharacter, rcCharacter, asText(makeCardWithBook()));
  const rc = JSON.parse(out.text ?? "");
  const book = rc.data.character_book;
  expect(book).toBeDefined();
  expect(book.entries).toHaveLength(1);
  expect(book.entries[0].keys).toEqual(["skyport"]);
  expect(book.entries[0].content).toBe("Floating docks ring every island.");
});

test("cross-format: an ST card with a book converts to a Risu .charx with the book intact", () => {
  const { out } = convertFile(stCharacter, risuCharacter, asText(makeCardWithBook()));
  expect(out.bytes).toBeDefined();
  const cardJson = JSON.parse(strFromU8(unzipSync(out.bytes!)["card.json"]!));
  const book = cardJson.data.character_book;
  expect(book).toBeDefined();
  expect(book.entries).toHaveLength(1);
  expect(book.entries[0].keys).toEqual(["skyport"]);
});

test("convertFile refuses a cross-kind conversion", () => {
  const card = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Bob", description: "x" } };
  expect(() => convertFile(stCharacter, rcLorebook, asText(card))).toThrow(/different entity kinds/);
});

test("convertFile routes registered regex adapters through the CLI conversion seam", async () => {
  await loadFormats();
  const source = registry.get("marinara-regex");
  const target = registry.get("sillytavern-regex");
  if (!source || !target) throw new Error("missing regex adapters");
  const text = JSON.stringify([{
    id: "trim",
    name: "Strip trailing spaces",
    enabled: true,
    findRegex: "[ \\t]+$",
    replaceString: "",
    trimStrings: [],
    placement: ["ai_output"],
    flags: "gm",
    promptOnly: false,
    targetCharacterIds: [],
    order: 0,
    minDepth: null,
    maxDepth: null,
    createdAt: "",
    updatedAt: "",
  }]);

  const { out } = convertFile(source, target, { text });

  expect(out.text?.length).toBeGreaterThan(0);
  expect(out.report).toBeDefined();
});

test("convertFile routes registered preset adapters through the CLI conversion seam", async () => {
  await loadFormats();
  const source = registry.get("sillytavern-preset");
  const target = registry.get("rolecall-preset");
  if (!source || !target) throw new Error("missing preset adapters");
  const text = await Bun.file(
    join(import.meta.dir, "../samples/sillytavern/presets/plain.preset.json"),
  ).text();

  const { out } = convertFile(source, target, { text });

  expect(out.text?.length).toBeGreaterThan(0);
  expect(out.report).toBeDefined();
});

test("every registered adapter can traverse the generic same-kind conversion seam", async () => {
  await loadFormats();
  for (const adapter of registry.all()) {
    // This adapter intentionally imports a Lumiverse wrapper but exports portable ST-flat JSON;
    // its output is owned by the sillytavern-preset reader, so self-read is not its wire contract.
    if (adapter.id === "lumiverse-preset") continue;
    const entity = minimalEntity(adapter.kind);
    const emitted = (
      adapter.fromCanonical as (value: ParsedCanonicalEntity) => AdapterOutput
    )(entity);
    const input = {
      text: emitted.text,
      bytes: emitted.bytes,
      filename: `conversion.${emitted.suggestedExtension}`,
    };

    expect(() => convertFile(adapter, adapter, input)).not.toThrow();
  }
});


test("inspectBundle extracts book and sets knowledgeRefs without emitting", () => {
  const card = makeCardWithBook();
  const bundle = inspectBundle(stCharacter, asText(card));
  expect(bundle.lorebooks).toHaveLength(1);
  expect(bundle.entity.body.knowledgeRefs).toEqual([bundle.lorebooks[0]!.id]);
  expect(bundle.lorebooks[0]!.body.name).toBe("Aetheria Lore");
});

test("inspectBundle with no book leaves knowledgeRefs unset", () => {
  const bare = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Bob", description: "x" } };
  const bundle = inspectBundle(stCharacter, asText(bare));
  expect(bundle.lorebooks).toHaveLength(0);
  expect(bundle.entity.body.knowledgeRefs).toBeUndefined();
});

test("rewriteKnowledgeRefs maps keep-both renames", () => {
  const card = makeCardWithBook();
  const { entity } = inspectBundle(stCharacter, asText(card));
  const oldId = entity.body.knowledgeRefs![0]!;
  rewriteKnowledgeRefs(entity, new Map([[oldId, `${oldId}-2`]]));
  expect(entity.body.knowledgeRefs).toEqual([`${oldId}-2`]);
});

test("emitBundle re-embeds resolved lorebooks into ST", () => {
  const card = makeCardWithBook();
  const { entity, lorebooks } = inspectBundle(stCharacter, asText(card));
  const out = emitBundle(stCharacter, entity, lorebooks);
  const back = JSON.parse(out.text ?? "");
  expect(back.data.character_book).toEqual(card.data.character_book);
});

test("emitBundle removes the stale embedded book after its canonical link is cleared", () => {
  const { entity } = inspectBundle(stCharacter, asText(makeCardWithBook()));
  entity.body.knowledgeRefs = [];

  const out = emitBundle(stCharacter, entity, []);
  const back = JSON.parse(out.text ?? "");

  expect(back.data.character_book).toBeUndefined();
  expect(back.data.extensions?.character_book).toBeUndefined();
});

test("emitBundle preserves the twin when lorebook resolution was not supplied", () => {
  const { entity } = inspectBundle(stCharacter, asText(makeCardWithBook()));

  const omitted = JSON.parse(emitBundle(stCharacter, entity).text ?? "");
  const requestedOnly = JSON.parse(emitBundle(stCharacter, entity, undefined, "json").text ?? "");

  expect(omitted.data.character_book).toBeDefined();
  expect(requestedOnly.data.character_book).toBeDefined();
});
