import { test, expect } from "bun:test";
import { unzipSync, strFromU8 } from "fflate";
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