import { test, expect } from "bun:test";
import { convertCard } from "./convert";
import stCharacter from "./formats/sillytavern/index";

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
  const { out, lorebooks } = convertCard(stCharacter, stCharacter, asText(card));

  // the embedded book was extracted and linked as a standalone canonical lorebook
  expect(lorebooks).toHaveLength(1);
  expect(lorebooks[0]!.body.name).toBe("Aetheria Lore");
  expect(lorebooks[0]!.id).toBe("aetheria-lore");

  // and it survives, byte-identical, in the target card's own character_book slot
  const back = JSON.parse(out.text ?? "");
  expect(back.data.character_book).toEqual(card.data.character_book);
  expect(back.data.character_book.entries[0].extensions.vectorized).toBe(true);
});

test("convertCard on a book-less card links nothing and writes no character_book", () => {
  const bare = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Bob", description: "x" } };
  const { out, lorebooks } = convertCard(stCharacter, stCharacter, asText(bare));
  expect(lorebooks).toHaveLength(0);
  const back = JSON.parse(out.text ?? "");
  expect(back.data.character_book).toBeUndefined();
});
