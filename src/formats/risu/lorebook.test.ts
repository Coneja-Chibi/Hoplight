/** Regression coverage for the lorebook.test behavior owned beside this file. */
import { test, expect } from "bun:test";
import risuLorebook from "./lorebook";
import { extractCharacterBook } from "../_shared/character-book";
import stWorldbook from "../sillytavern/lorebook";
import type { LorebookEntry } from "../../entities/lorebook/schema";

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

/** A native Risu lore envelope with one selective, always-active, regex-free entry. */
function nativeEnvelope() {
  return {
    type: "risu",
    ver: 1,
    data: [
      {
        key: "alpha,beta",
        secondkey: "gamma",
        insertorder: 42,
        comment: "Node",
        content: "the body",
        // NOTE: mode:"folder" marks a FOLDER row (a category, not content) - the old fixture wrongly
        // used it on a content entry, an impossible wire shape that hid the folder mapping.
        mode: "normal",
        alwaysActive: true,
        selective: true,
        role: "assistant",
        activationPercent: 80,
        useRegex: false,
        extentions: { risu_case_sensitive: true },
        id: "x1",
      },
    ],
  };
}

test("risu-lorebook detects native envelope and soft-accepts character_book extracts", () => {
  expect(risuLorebook.detect(asText(nativeEnvelope()))).toBe(1);
  expect(risuLorebook.detect(asText({ entries: { "0": { key: ["x"], content: "y" } } }))).toBe(0); // ST worldbook
  expect(risuLorebook.detect(asText({ type: "risu", ver: 1 }))).toBe(0); // no data array
  // card-extracted character_book (entries array + keys)
  expect(
    risuLorebook.detect(asText({ entries: [{ keys: ["x"], content: "y", name: "n" }], scan_depth: 4 })),
  ).toBe(0.75);
});

test("risu-lorebook maps native fields to the canonical entry", () => {
  const canon = risuLorebook.toCanonical(asText(nativeEnvelope()));
  const e = canon.body.entries[0]!;
  expect(e.id).toBe("x1");
  expect(e.title).toBe("Node");
  expect(e.comment).toBe("Node"); // Risu stores name AND comment = the label
  expect(e.content).toBe("the body");
  expect(e.constant).toBe(true); // <- alwaysActive, not mode
  expect(e.triggers.map((t) => t.keyword)).toEqual(["alpha", "beta"]);
  expect(e.secondaryTriggers.map((t) => t.keyword)).toEqual(["gamma"]);
  expect(e.triggerMode).toBe("advanced");
  expect(e.sortOrder).toBe(42); // insertorder -> sortOrder (NOT priority)
  expect(e.priority).toBe(100);
  expect(e.probability).toBe(80); // <- activationPercent
  expect(e.caseSensitive).toBe(true); // <- extentions.risu_case_sensitive
  expect(e.role).toBe("assistant"); // native-richer than the .charx path
});

test("risu-lorebook round-trips a native envelope byte-identical (original-of-raw twin)", () => {
  const src = nativeEnvelope();
  const canon = risuLorebook.toCanonical(asText(src));
  const out = JSON.parse(risuLorebook.fromCanonical(canon).text ?? "");
  // unedited: comma spacing preserved ("alpha,beta" not "alpha, beta"), mode residue preserved
  expect(out).toEqual(src);
});

test("risu-lorebook re-encodes only edited fields, preserving Risu-only residue", () => {
  const canon = risuLorebook.toCanonical(asText(nativeEnvelope()));
  const edited = structuredClone(canon);
  edited.body.entries[0]!.content = "rewritten";
  const out = JSON.parse(risuLorebook.fromCanonical(edited).text ?? "");
  expect(out.data[0].content).toBe("rewritten");
  expect(out.data[0].key).toBe("alpha,beta"); // untouched: no space injected
  expect(out.data[0].mode).toBe("normal"); // mode residue survives the twin clone
  expect(out.data[0].alwaysActive).toBe(true);
});

/**
 * The container-invariance contract: the SAME Risu lore canonicalizes identically whether it arrives
 * as a native envelope or embedded in a `.charx` (routed through character-book.ts). We build the exact
 * character_book Risu's own writer emits for `nativeEnvelope()`'s entry and assert the canonical bodies
 * match on every shared field. `id` and `role` are excluded: Risu's `.charx` writer drops both, so the
 * native format is legitimately richer there (a source asymmetry, not a vaud modeling inconsistency).
 */
test("risu-lorebook canonicalizes identically to the embedded .charx path", () => {
  const nativeEntry = risuLorebook.toCanonical(asText(nativeEnvelope())).body.entries[0]!;

  // Risu's characterCards.ts loreBook -> character_book mapping, applied to the same entry.
  const charBookCard = {
    data: {
      character_book: {
        entries: [
          {
            keys: ["alpha", "beta"],
            secondary_keys: ["gamma"],
            content: "the body",
            extensions: { risu_case_sensitive: true, risu_activationPercent: 80 },
            enabled: true,
            insertion_order: 42,
            constant: true,
            selective: true,
            name: "Node",
            comment: "Node",
            case_sensitive: true,
            use_regex: false,
          },
        ],
      },
    },
  };
  const embeddedEntry = extractCharacterBook(charBookCard)!.body.entries[0]!;

  const shared = (e: LorebookEntry): Partial<LorebookEntry> => {
    const { id: _id, role: _role, ...rest } = e;
    return rest;
  };
  expect(shared(nativeEntry)).toEqual(shared(embeddedEntry));
});

test("cross-format: an ST worldbook writes a Risu native lorebook (no-twin full encode)", () => {
  const worldbook = {
    entries: {
      "0": { uid: 0, comment: "Skyports", content: "Floating docks.", key: ["skyport"], position: 2, order: 100 },
    },
    name: "Aetheria",
  };
  const canon = stWorldbook.toCanonical(asText(worldbook)); // original keyed "sillytavern-lorebook"
  const out = JSON.parse(risuLorebook.fromCanonical(canon).text ?? ""); // no risu twin -> full encode
  expect(out.type).toBe("risu");
  expect(out.data[0].comment).toBe("Skyports");
  expect(out.data[0].content).toBe("Floating docks.");
  expect(out.data[0].key).toBe("skyport");
  expect(out.data[0].mode).toBe("normal");
  expect(out.data[0].alwaysActive).toBe(false);
});

/**
 * RECONCILED (#15): placement order has ONE canonical home, `sortOrder`, across every codec. A Risu
 * `insertorder` therefore lands in ST worldbook `order` (the placement axis) on convert, NOT in eviction
 * `priority`. And per the de-original doctrine (CF-1): `displayIndex` is a DISTINCT authored axis, not a
 * function of placement, so a Risu book that never authored one must NOT have it fabricated from sortOrder
 * on cross-format export (the old fabrication corrupted real cards where order != displayIndex).
 */
test("risu insertorder lands in ST worldbook `order` (placement), and displayIndex is not fabricated", () => {
  const canon = risuLorebook.toCanonical(asText(nativeEnvelope())); // insertorder: 42 -> sortOrder
  const out = JSON.parse(stWorldbook.fromCanonical(canon).text ?? ""); // no ST twin -> full encode
  const e = out.entries["0"]!;
  expect(e.order).toBe(42); // placement lands in ST `order`
  expect(e.displayIndex).toBeUndefined(); // Risu authored no displayIndex -> none fabricated
});

// -- De-original W2: Risu's entry-folder hierarchy is first-class (folders -> categories, folder ref ->
// categoryId), no longer opaque original residue. --

function folderedEnvelope() {
  return {
    type: "risu",
    ver: 1,
    data: [
      { key: "", secondkey: "", insertorder: 100, comment: "Places", content: "", mode: "folder", alwaysActive: false, selective: false, id: "f1", loreCache: { key: "k", data: ["c"] } },
      { key: "inn", secondkey: "", insertorder: 10, comment: "The Inn", content: "A busy inn.", mode: "child", alwaysActive: false, selective: false, id: "e1", folder: "f1" },
      { key: "moon", secondkey: "", insertorder: 20, comment: "The Moon", content: "It watches.", mode: "normal", alwaysActive: false, selective: false, id: "e2" },
    ],
  };
}

test("folders: folder rows become categories, child folder refs become categoryId", () => {
  const canon = risuLorebook.toCanonical(asText(folderedEnvelope()));
  expect(canon.body.categories).toEqual([{ id: "f1", name: "Places", sortOrder: 0 }]);
  expect(canon.body.entries.map((e) => [e.id, e.categoryId])).toEqual([
    ["e1", "f1"],
    ["e2", null],
  ]);
});

test("folders: unedited round-trip re-emits byte-identical, folder residue intact", () => {
  const src = folderedEnvelope();
  const canon = risuLorebook.toCanonical(asText(src));
  expect(JSON.parse(risuLorebook.fromCanonical(canon).text ?? "")).toEqual(src);
});

test("folders edit: renaming a category + re-filing an entry reaches the wire", () => {
  const canon = risuLorebook.toCanonical(asText(folderedEnvelope()));
  canon.body.categories![0]!.name = "Locations";
  canon.body.entries[0]!.categoryId = null; // pull The Inn out of the folder
  canon.body.entries[1]!.categoryId = "f1"; // file The Moon into it
  const out = JSON.parse(risuLorebook.fromCanonical(canon).text ?? "");
  const folderRow = out.data.find((r: { mode?: string }) => r.mode === "folder");
  expect(folderRow.comment).toBe("Locations");
  expect(folderRow.loreCache).toEqual({ key: "k", data: ["c"] }); // runtime-cache residue rides the clone
  expect(out.data.find((r: { id?: string }) => r.id === "e1").folder).toBe("");
  expect(out.data.find((r: { id?: string }) => r.id === "e2").folder).toBe("f1");
});
