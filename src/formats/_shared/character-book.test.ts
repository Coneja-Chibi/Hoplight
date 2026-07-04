import { test, expect } from "bun:test";
import {
  findCharacterBook,
  extractCharacterBook,
  characterBookToLorebook,
  lorebooksToCharacterBook,
} from "./character-book";
import stCharacter from "../sillytavern/index";
import stWorldbook from "../sillytavern/lorebook";

/**
 * A CCv3 card with an embedded character_book. The book uses CCv3 spec names at the entry top level
 * (keys/secondary_keys/insertion_order/use_regex + the coarse before_char/after_char position) and
 * hides the ST-extended fields (precise position, depth, role, selective_logic, group, probability,
 * scan sources) in each entry's `extensions` bag - which must win over the coarse top-level values.
 * `extensions.chub` on the card stands in for a Chub export's provenance bag (tier A: Chub falls out
 * of the CCv2/v3 path + this extraction).
 */
function makeCardWithBook() {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Aria",
      description: "a skyport navigator",
      extensions: { chub: { full_path: "user/aria", id: 42 } },
      character_book: {
        name: "Aetheria Lore",
        description: "the floating world",
        scan_depth: 5,
        token_budget: 2048,
        recursive_scanning: true,
        extensions: { source: "chub" },
        entries: [
          {
            id: 0,
            name: "The Skyports",
            comment: "authoring note",
            content: "Floating docks ring every island.",
            keys: ["skyport", "/dock(s)?/i"],
            secondary_keys: ["harbor"],
            selective: true,
            constant: false,
            enabled: true,
            insertion_order: 10,
            position: "before_char",
            use_regex: false,
            case_sensitive: null,
            priority: 100,
            extensions: {
              position: 2, // precise ST slot (before_example) - wins over coarse before_char
              depth: 4,
              role: 0,
              selective_logic: 3, // and_all
              probability: 100,
              useProbability: false,
              group: "places",
              group_weight: 5,
              sticky: 3,
              cooldown: 2,
              delay: 1,
              scan_depth: 5,
              exclude_recursion: true,
              matchCharacterDescription: true,
              matchScenario: true,
              vectorized: true, // raw-only residue, no canonical home
            },
          },
          {
            id: 1,
            name: "Common Tongue",
            content: "Everyone speaks it.",
            keys: ["language"],
            secondary_keys: [],
            constant: true,
            enabled: true,
            insertion_order: 20,
            position: "after_char",
            use_regex: false,
            extensions: { probability: 50, useProbability: true },
          },
        ],
      },
    },
  };
}

/** A standalone ST worldbook - a lorebook whose escrow key is `sillytavern-lorebook`, NOT
 * `character-book`. Re-embedding it exercises the from-scratch (no-twin) encode path that
 * cross-format card conversion actually hits. */
function makeWorldbook() {
  return {
    entries: {
      "0": {
        uid: 0,
        comment: "Skyports",
        content: "Floating docks ring every island.",
        key: ["skyport", "/dock/i"],
        keysecondary: ["harbor"],
        selective: true,
        selectiveLogic: 3,
        position: 2,
        role: 0,
        order: 100,
        displayIndex: 0,
        group: "places",
        groupWeight: 5,
        probability: 100,
        useProbability: false,
        constant: false,
        disable: false,
      },
    },
    name: "Aetheria",
    scan_depth: 4,
    token_budget: 2048,
    recursive_scanning: true,
  };
}

/** A minimal CCv3 card that carries NO embedded book - a clean host for re-embed. */
const bareCard = () => ({ spec: "chara_card_v3", spec_version: "3.0", data: { name: "Bob", description: "x" } });

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

test("findCharacterBook locates the CCv3 data.character_book slot", () => {
  const card = makeCardWithBook();
  const book = findCharacterBook(card);
  expect(book?.name).toBe("Aetheria Lore");
  expect(book?.entries).toHaveLength(2);
  // a bare card without a book yields null (no false positives)
  expect(findCharacterBook({ data: { name: "x" } })).toBe(null);
  // CCv2 convention: the book under data.extensions.character_book
  const v2 = { data: { name: "y", extensions: { character_book: { entries: [] } } } };
  expect(findCharacterBook(v2)?.entries).toEqual([]);
});

test("characterBookToLorebook maps CCv3 names + reads ST extras from extensions (extensions wins)", () => {
  const book = findCharacterBook(makeCardWithBook())!;
  const body = characterBookToLorebook(book);

  expect(body.name).toBe("Aetheria Lore");
  expect(body.globalScanDepth).toBe(5);
  expect(body.globalRecursion).toBe(true);
  expect(body.tokenBudget).toBe(2048);
  expect(body.entries).toHaveLength(2);

  const e0 = body.entries[0]!;
  expect(e0.id).toBe("0");
  expect(e0.title).toBe("The Skyports"); // from `name`
  expect(e0.comment).toBe("authoring note"); // from `comment`
  expect(e0.triggers).toEqual([
    { keyword: "skyport", isRegex: false },
    { keyword: "dock(s)?", isRegex: true, flags: "i" },
  ]);
  expect(e0.secondaryTriggers).toEqual([{ keyword: "harbor", isRegex: false }]);
  expect(e0.triggerMode).toBe("advanced"); // selective true
  expect(e0.selectiveLogic).toBe("and_all"); // ext selective_logic 3
  expect(e0.position).toBe("before_example"); // ext.position 2 beats coarse before_char
  expect(e0.depth).toBe(4);
  expect(e0.role).toBe("system");
  expect(e0.sortOrder).toBe(10); // insertion_order
  expect(e0.priority).toBe(100);
  expect(e0.groupName).toBe("places");
  expect(e0.groupWeight).toBe(5);
  expect(e0.sticky).toBe(3);
  expect(e0.excludeRecursion).toBe(true);
  expect(e0.scanCharacterDescription).toBe(true);
  expect(e0.scanScenario).toBe(true);
  expect(e0.probability).toBe(100); // useProbability false -> 100, so no per-trigger probability

  const e1 = body.entries[1]!;
  expect(e1.constant).toBe(true);
  expect(e1.position).toBe("character"); // after_char
  expect(e1.probability).toBe(50);
  // probability != 100 rides onto each trigger
  expect(e1.triggers).toEqual([{ keyword: "language", isRegex: false, probability: 50 }]);
  expect(e1.triggerMode).toBe("simple");
});

test("extractCharacterBook produces a CanonicalLorebook carrying the raw book in its own escrow", () => {
  const lb = extractCharacterBook(makeCardWithBook())!;
  expect(lb.kind).toBe("lorebook");
  expect(lb.id).toBe("aetheria-lore");
  expect(lb.body.entries).toHaveLength(2);
  // raw-only residue survives in the lorebook's OWN escrow (so a standalone write keeps it)
  const raw = lb.escrow?.["character-book"]?.raw as ReturnType<typeof makeCardWithBook>["data"]["character_book"];
  expect((raw.entries[0]!.extensions as { vectorized?: boolean }).vectorized).toBe(true);
  // a card with no book extracts nothing
  expect(extractCharacterBook({ data: { name: "x" } })).toBe(null);
});

test("the character adapter round-trips the whole card (embedded book + chub bag) untouched", () => {
  const card = makeCardWithBook();
  const ent = stCharacter.toCanonical(asText(card));
  // no context -> no re-embed -> the raw card is left fully intact
  const back = JSON.parse(stCharacter.fromCanonical(ent).text ?? "");
  expect(back.data.character_book.entries[0].extensions.vectorized).toBe(true);
  expect(back.data.extensions.chub).toEqual({ full_path: "user/aria", id: 42 });
});

// -- re-embed / export direction (the Full-scope half) ---------------------------------------------

test("GATING: a no-twin lorebook re-embeds into data.character_book, encoded from body alone", () => {
  const lb = stWorldbook.toCanonical(asText(makeWorldbook()));
  expect(lb.escrow?.["character-book"]).toBeUndefined(); // no character_book twin: from-scratch path
  const character = stCharacter.toCanonical(asText(bareCard()));

  const back = JSON.parse(stCharacter.fromCanonical(character, { lorebooks: [lb] }).text ?? "");
  const book = back.data.character_book;
  expect(book).toBeDefined();
  expect(book.entries).toHaveLength(1);

  const be = book.entries[0];
  expect(be.keys).toEqual(["skyport", "/dock/i"]); // rebuilt from canonical triggers
  expect(be.secondary_keys).toEqual(["harbor"]);
  expect(be.content).toBe("Floating docks ring every island.");
  expect(be.name).toBe("Skyports");
  expect(be.use_regex).toBe(false); // mixed entry: regex stays inline (/dock/i), literals stay literal
  expect(be.insertion_order).toBe(0);
  expect(be.position).toBe("before_char"); // before_example -> coarse
  expect(be.extensions.position).toBe(2); // precise ST slot
  expect(be.extensions.selective_logic).toBe(3); // and_all
  expect(be.extensions.group).toBe("places");
  expect(be.extensions.group_weight).toBe(5);
});

test("a no-twin re-embed re-parses back to the same canonical lorebook (round-trip through the slot)", () => {
  const lb = stWorldbook.toCanonical(asText(makeWorldbook()));
  const character = stCharacter.toCanonical(asText(bareCard()));
  const back = JSON.parse(stCharacter.fromCanonical(character, { lorebooks: [lb] }).text ?? "");
  const reparsed = characterBookToLorebook(findCharacterBook(back)!);

  const a = lb.body.entries[0]!;
  const b = reparsed.entries[0]!;
  expect(b.triggers).toEqual(a.triggers);
  expect(b.secondaryTriggers).toEqual(a.secondaryTriggers);
  expect(b.position).toBe(a.position);
  expect(b.selectiveLogic).toBe(a.selectiveLogic);
  expect(b.groupName).toBe(a.groupName);
  expect(b.sortOrder).toBe(a.sortOrder);
});

test("a same-dialect (twin present) re-embed overlays byte-identically when unedited", () => {
  const card = makeCardWithBook();
  const lb = extractCharacterBook(card)!; // carries the character_book twin in escrow
  const character = stCharacter.toCanonical(asText(card));
  const back = JSON.parse(stCharacter.fromCanonical(character, { lorebooks: [lb] }).text ?? "");
  expect(back.data.character_book).toEqual(card.data.character_book);
});

test("an edited lorebook entry re-embeds the change while raw-only residue survives", () => {
  const card = makeCardWithBook();
  const lb = extractCharacterBook(card)!;
  lb.body.entries[0]!.content = "Rebuilt after the storm.";
  const character = stCharacter.toCanonical(asText(card));
  const back = JSON.parse(stCharacter.fromCanonical(character, { lorebooks: [lb] }).text ?? "");
  expect(back.data.character_book.entries[0].content).toBe("Rebuilt after the storm.");
  expect(back.data.character_book.entries[0].extensions.vectorized).toBe(true); // untouched residue
});

test("N>1 refs merge into one character_book with recorded split boundaries", () => {
  const l1 = extractCharacterBook(makeCardWithBook())!; // 2 entries
  const l2 = stWorldbook.toCanonical(asText(makeWorldbook())); // 1 entry
  const book = lorebooksToCharacterBook([l1, l2])!;
  expect(book.entries).toHaveLength(3);
  expect((book.extensions as { vaud_source_books?: unknown }).vaud_source_books).toEqual([
    { name: "Aetheria Lore", entryCount: 2 },
    { name: "Aetheria", entryCount: 1 },
  ]);
});
