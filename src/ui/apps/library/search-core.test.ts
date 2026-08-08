/**
 * search-core tests - the Library search bar's whole meaning, checked without a browser.
 *
 * The cases that matter most here are not "does contains work". They are the three ways a search
 * box over 164 pieces goes wrong in a way nobody reports as a bug: the thing you typed the exact
 * name of comes eleventh, the shelf reshuffles between renders so you cannot find it twice, and a
 * filtered-to-nothing shelf looks exactly like a deck you have never put anything in.
 */
import { describe, expect, test } from "bun:test";
import {
  isFilteredEmpty,
  matchesByKind,
  parseQuery,
  resultLine,
  searchPieces,
  unknownHint,
  type SearchablePiece,
} from "./search-core";

const piece = (over: Partial<SearchablePiece> & { name: string }): SearchablePiece => ({
  id: over.name.toLowerCase().replace(/\s+/g, "-"),
  kind: "character",
  ...over,
});

const names = (pieces: readonly SearchablePiece[], query: string): string[] =>
  searchPieces(pieces, parseQuery(query)).map((hit) => hit.piece.name);

describe("parseQuery", () => {
  test("an empty box is not an active search (the whole shelf, unranked)", () => {
    const parsed = parseQuery("   ");
    expect(parsed.active).toBe(false);
    expect(parsed.terms).toEqual([]);
  });

  test("bare words become AND-ed text terms, lowercased", () => {
    expect(parseQuery("Blue Eyes").terms).toEqual([
      { field: "text", value: "blue", negated: false },
      { field: "text", value: "eyes", negated: false },
    ]);
  });

  test("a quoted phrase stays ONE term, spaces and all", () => {
    expect(parseQuery('"blue eyes"').terms).toEqual([{ field: "text", value: "blue eyes", negated: false }]);
  });

  test("an unterminated quote runs to the end rather than refusing to parse (somebody is mid-type)", () => {
    expect(parseQuery('"blue ey').terms).toEqual([{ field: "text", value: "blue ey", negated: false }]);
  });

  test("field terms parse, and deck: is an alias for kind:", () => {
    expect(parseQuery("kind:preset from:sillytavern has:art").terms).toEqual([
      { field: "kind", value: "preset", negated: false },
      { field: "from", value: "sillytavern", negated: false },
      { field: "has", value: "art", negated: false },
    ]);
    expect(parseQuery("deck:lorebook").terms).toEqual([{ field: "kind", value: "lorebook", negated: false }]);
  });

  test("a leading dash negates; a lone dash is a search for a hyphen", () => {
    expect(parseQuery("-has:art").terms).toEqual([{ field: "has", value: "art", negated: true }]);
    expect(parseQuery("-").terms).toEqual([{ field: "text", value: "-", negated: false }]);
  });

  test("a field with nothing after it yet is DROPPED, not treated as matching nothing", () => {
    // Mid-type ("kind:") must show the whole deck. Blanking the shelf between keystrokes reads as
    // "your pieces are gone" for as long as it takes to finish the word.
    const parsed = parseQuery("kind:");
    expect(parsed.terms).toEqual([]);
    expect(parsed.active).toBe(false);
  });

  test("an unknown field is searched as literal text, and said out loud", () => {
    const parsed = parseQuery("colour:blue");
    expect(parsed.terms).toEqual([{ field: "text", value: "colour:blue", negated: false }]);
    expect(parsed.unknown).toEqual(["colour:"]);
  });

  test("a colon inside a name is punctuation, not a typo worth reporting", () => {
    // "Chapter 2: The Fall" is the exact input that a strict field parser answers with nothing.
    const parsed = parseQuery("Chapter 2: The Fall");
    expect(parsed.unknown).toEqual([]);
    expect(parsed.terms.map((t) => t.value)).toEqual(["chapter", "2:", "the", "fall"]);
  });

  test("an unknown has: facet is reported and matches nothing (no guessing which fact was meant)", () => {
    const parsed = parseQuery("has:wings");
    expect(parsed.unknown).toEqual(["has:wings"]);
    expect(searchPieces([piece({ name: "Aria", hasPortrait: true })], parsed)).toEqual([]);
  });
});

describe("searchPieces: ranking", () => {
  const shelf = [
    piece({ name: "Warehouse Keeper" }),
    piece({ name: "The Great War" }),
    piece({ name: "Software Ward" }),
    piece({ name: "War" }),
  ];

  test("an exact name match leads, then prefix, then word-start, then buried substring", () => {
    // THE HEADLINE REQUIREMENT. Without tiers, "War" is fourth on disk order and stays fourth.
    expect(names(shelf, "war")).toEqual(["War", "Warehouse Keeper", "The Great War", "Software Ward"]);
  });

  test("one exact name still beats a pile of incidental substrings", () => {
    // Two weak terms must not add up into a strong tier: that is exactly how a 142-piece deck
    // buries the thing somebody typed the whole name of.
    const pieces = [
      piece({ name: "Warden of the Warm Ward" }),
      piece({ name: "War" }),
    ];
    expect(names(pieces, "war")).toEqual(["War", "Warden of the Warm Ward"]);
    expect(names(pieces, "war ward")).toEqual(["Warden of the Warm Ward"]);
  });

  test("multiple bare terms AND together, in any order", () => {
    const pieces = [piece({ name: "Blue Eyed Knight" }), piece({ name: "Blue Cloak" })];
    expect(names(pieces, "blue knight")).toEqual(["Blue Eyed Knight"]);
    expect(names(pieces, "knight blue")).toEqual(["Blue Eyed Knight"]);
  });

  test("a quoted phrase is held together: it needs the space, two bare words do not", () => {
    const pieces = [piece({ name: "Blue Eyes" }), piece({ name: "Eyes of Blue" })];
    expect(names(pieces, '"blue eyes"')).toEqual(["Blue Eyes"]);
    expect(names(pieces, "blue eyes").sort()).toEqual(["Blue Eyes", "Eyes of Blue"]);
  });

  test("an empty query returns EVERY piece in the original order, untouched", () => {
    // The shelf must look exactly as it does with no search at all, including its order.
    const pieces = [piece({ name: "Zeta" }), piece({ name: "Alpha" }), piece({ name: "Mid" })];
    expect(names(pieces, "")).toEqual(["Zeta", "Alpha", "Mid"]);
  });

  test("a pure filter never reorders the shelf either", () => {
    // `has:art` says which pieces are eligible, not which one you meant. Reordering on a filter
    // would move pieces under the cursor of somebody who only asked to hide some.
    const pieces = [
      piece({ name: "Zeta", hasPortrait: true }),
      piece({ name: "Alpha", hasPortrait: false }),
      piece({ name: "Mid", hasPortrait: true }),
    ];
    expect(names(pieces, "has:art")).toEqual(["Zeta", "Mid"]);
  });

  test("ties break deterministically: the same set ranks the same however it arrives", () => {
    // Ranking runs again on every render of the room. A comparator that returns 0 for two real
    // pieces lets them swap places when something unrelated repaints, and a shelf you cannot find
    // the same thing on twice is worse than one that ranks slightly wrong.
    const a = piece({ name: "Echo", id: "echo-1" });
    const b = piece({ name: "Echo", id: "echo-2" });
    const c = piece({ name: "Echoes", id: "echoes" });
    expect(searchPieces([a, b, c], parseQuery("echo")).map((h) => h.piece.id)).toEqual([
      "echo-1",
      "echo-2",
      "echoes",
    ]);
    expect(searchPieces([c, b, a], parseQuery("echo")).map((h) => h.piece.id)).toEqual([
      "echo-1",
      "echo-2",
      "echoes",
    ]);
  });

  test("nothing matching returns an empty list, never the whole shelf", () => {
    expect(searchPieces([piece({ name: "Aria" })], parseQuery("zzz"))).toEqual([]);
  });
});

describe("searchPieces: what a bare term reaches", () => {
  test("id matches, and ranks below any name match", () => {
    const byId = piece({ name: "Nameless", id: "aria-2" });
    const byName = piece({ name: "Aria Softly", id: "x" });
    expect(names([byId, byName], "aria")).toEqual(["Aria Softly", "Nameless"]);
  });

  test("a lorebook's trigger keywords are searchable: what a book is about is rarely its name", () => {
    const book = piece({ name: "Book Three", kind: "lorebook", searchKeys: ["Dragonspire", "keep"] });
    expect(names([book], "dragonspire")).toEqual(["Book Three"]);
  });

  test("the source chip's own words match, and rank below id", () => {
    const bySource = piece({ name: "Nameless", id: "x", sourceLabel: "RoleCall · V3", sourceFormat: "rolecall" });
    expect(names([bySource], "rolecall")).toEqual(["Nameless"]);
    expect(names([bySource], "v3")).toEqual(["Nameless"]);
  });

  test("provenance matches, since it is the sentence the import receipt showed", () => {
    const p = piece({ name: "Nameless", id: "x", provenance: "A character card, made for SillyTavern." });
    expect(names([p], "sillytavern")).toEqual(["Nameless"]);
  });
});

describe("searchPieces: the field terms", () => {
  const studio = [
    piece({ name: "Aria", kind: "character", hasPortrait: true, sourceFormat: "sillytavern", sourceVariant: "v3" }),
    piece({ name: "Grimoire", kind: "lorebook", searchKeys: ["dragon"] }),
    piece({ name: "Big Set", kind: "preset" }),
    piece({ name: "Sprites", kind: "pack" }),
    piece({ name: "Cleanup", kind: "regex" }),
  ];

  test("kind: accepts the internal kind, the chip's plural, and the short tag", () => {
    expect(names(studio, "kind:preset")).toEqual(["Big Set"]);
    expect(names(studio, "kind:presets")).toEqual(["Big Set"]);
    expect(names(studio, "kind:pre")).toEqual(["Big Set"]);
  });

  test("an ambiguous deck word lands on BOTH decks rather than silently picking one", () => {
    // "set" is the presets deck's short tag and also a word in "Regex sets". A prefix filter over
    // the words the chips actually wear is allowed to be ambiguous; the chip counts then say which
    // deck holds what. Picking a winner here would hide a whole deck for no stated reason.
    expect(names(studio, "kind:set")).toEqual(["Big Set", "Cleanup"]);
  });

  test("kind: lands on the deck whose plural is not its kind plus an s", () => {
    // "Sprite packs" is the one deck where the words on the chip and the kind string diverge, so
    // it is the one that proves the field is not a trivia quiz about names nobody sees.
    expect(names(studio, "kind:sprite")).toEqual(["Sprites"]);
    expect(names(studio, "kind:packs")).toEqual(["Sprites"]);
    expect(names(studio, "kind:rgx")).toEqual(["Cleanup"]);
  });

  test("name: and id: narrow to one field when free text drags in noise", () => {
    const noisy = [piece({ name: "Dragon", id: "x" }), piece({ name: "Nameless", id: "dragon-2" })];
    expect(names(noisy, "name:dragon")).toEqual(["Dragon"]);
    expect(names(noisy, "id:dragon")).toEqual(["Nameless"]);
  });

  test("from: matches the format id and the variant", () => {
    expect(names(studio, "from:sillytavern")).toEqual(["Aria"]);
    expect(names(studio, "from:v3")).toEqual(["Aria"]);
  });

  test("has: art / source / keys, and every one of them negates", () => {
    expect(names(studio, "has:art")).toEqual(["Aria"]);
    expect(names(studio, "has:source")).toEqual(["Aria"]);
    expect(names(studio, "has:keys")).toEqual(["Grimoire"]);
    expect(names(studio, "-has:art")).toEqual(["Grimoire", "Big Set", "Sprites", "Cleanup"]);
    // "things I made here" is exactly -has:source, which is why the facet earns its place.
    expect(names(studio, "-has:source")).toEqual(["Grimoire", "Big Set", "Sprites", "Cleanup"]);
  });

  test("a field term and free text AND together", () => {
    expect(names(studio, "kind:character aria")).toEqual(["Aria"]);
    expect(names(studio, "kind:lorebook aria")).toEqual([]);
  });

  test("a negated text term excludes without ranking", () => {
    const pieces = [piece({ name: "War Drums" }), piece({ name: "War Paint" })];
    expect(names(pieces, "war -paint")).toEqual(["War Drums"]);
  });
});

describe("matchesByKind", () => {
  test("counts per deck, biggest first, ties by kind so the jump buttons never shuffle", () => {
    const hits = searchPieces(
      [
        piece({ name: "A", kind: "preset" }),
        piece({ name: "B", kind: "preset" }),
        piece({ name: "C", kind: "lorebook" }),
        piece({ name: "D", kind: "character" }),
      ],
      parseQuery(""),
    );
    expect(matchesByKind(hits)).toEqual([
      { kind: "preset", count: 2 },
      { kind: "character", count: 1 },
      { kind: "lorebook", count: 1 },
    ]);
  });
});

describe("unknownHint", () => {
  test("silent when everything parsed", () => {
    expect(unknownHint([])).toBe("");
  });

  test("an unknown field says it was still searched, an unknown fact says it matched nothing", () => {
    // The two endings are the point: one explains a result, the other explains an EMPTY result.
    expect(unknownHint(["colour:"])).toContain("is not a field, so it was searched as plain text");
    expect(unknownHint(["has:wings"])).toContain("is not something a piece can have, so nothing matches it");
    expect(unknownHint(["colour:", "size:"])).toContain("are not fields");
  });

  test("always names the fields that do exist, so the hint is a way out and not a scolding", () => {
    expect(unknownHint(["colour:"])).toContain("name: id: kind: from: has:art");
  });
});

describe("resultLine", () => {
  const line = (over: Partial<Parameters<typeof resultLine>[0]>): string =>
    resultLine({ active: true, deckPlural: "Presets", shown: 0, deckTotal: 142, elsewhere: 0, ...over });

  test("silent when nothing is being searched for", () => {
    expect(line({ active: false, shown: 5 })).toBe("");
  });

  test("always says how many of how many", () => {
    expect(line({ shown: 12 })).toBe("12 of 142 presets match");
  });

  test("no match says so IN WORDS, and points at the deck that does match", () => {
    // A bare "0" here is the failure this line exists to prevent: it is the same picture as a deck
    // nobody has put anything in yet, and the two mean completely different things.
    expect(line({ shown: 0, elsewhere: 3 })).toBe("no presets match · 3 elsewhere");
    expect(line({ shown: 0, elsewhere: 0 })).toBe("nothing in the studio matches");
  });

  test("A DECK WITH NOTHING IN IT WAS NOT FILTERED, and never says it was", () => {
    // The same confusion inverted, and the one a table of "142 total" rows never catches: typing
    // anything while standing on an empty deck must not report the search as the reason it is bare.
    expect(line({ shown: 0, deckTotal: 0, elsewhere: 0 })).toBe("no presets yet");
    expect(line({ shown: 0, deckTotal: 0, elsewhere: 4 })).toBe("no presets yet · 4 elsewhere");
  });
});

describe("isFilteredEmpty", () => {
  test("only a deck that HAD something to hide counts as filtered", () => {
    expect(isFilteredEmpty(parseQuery("war"), 142)).toBe(true);
    // Nothing typed: whatever is empty was already empty.
    expect(isFilteredEmpty(parseQuery(""), 142)).toBe(false);
    // Typed, but the deck holds nothing. The ghost card ("your first persona lands here") is the
    // honest picture; the notice would claim a search hid pieces that never existed.
    expect(isFilteredEmpty(parseQuery("war"), 0)).toBe(false);
  });
});

describe("searchPieces: collection:", () => {
  const studio = [
    piece({ name: "Aria", collections: ["the-cast", "act-ii"] }),
    piece({ name: "Basil", collections: ["the-cast"] }),
    piece({ name: "Nobody", kind: "preset" }),
  ];

  test("one group, by its id", () => {
    expect(names(studio, "collection:the-cast")).toEqual(["Aria", "Basil"]);
    expect(names(studio, "collection:act-ii")).toEqual(["Aria"]);
  });

  test("`in:` is the same field, because that is how people say it", () => {
    expect(names(studio, "in:the-cast")).toEqual(["Aria", "Basil"]);
  });

  test("A GROUP DOES NOT REORDER WHAT IS IN IT", () => {
    /**
     * Membership is a filter, and scoring it would be actively wrong: everything in a group is
     * there because somebody put it there, so nothing in one is a better match than anything else.
     * The shelf keeps the order it arrived in.
     */
    const hits = searchPieces(studio, parseQuery("collection:the-cast"));
    expect(hits.map((h) => h.score)).toEqual([0, 0]);
  });

  test("it combines with the other fields, and negates", () => {
    expect(names(studio, "collection:the-cast kind:character")).toEqual(["Aria", "Basil"]);
    expect(names(studio, "-collection:the-cast")).toEqual(["Nobody"]);
    expect(names(studio, "collection:the-cast -collection:act-ii")).toEqual(["Basil"]);
  });

  test("A GROUP NOBODY IS IN MATCHES NOTHING, rather than everything", () => {
    // Fail closed, like has:. A filter that silently turns into "show all" when its target is gone
    // hands back the wrong shelf with no way to see that it did.
    expect(names(studio, "collection:deleted-yesterday")).toEqual([]);
  });
});
