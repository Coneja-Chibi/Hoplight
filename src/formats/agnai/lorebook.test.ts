import { test, expect } from "bun:test";
import agnaiLorebook from "./lorebook";
import stWorldbook from "../sillytavern/lorebook";

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

/** A standalone Agnai memory book (as `encodeBook` emits it: no `_id`/`userId`). */
function memoryBook() {
  return {
    kind: "memory",
    name: "Aetheria",
    description: "floating city lore",
    entries: [
      {
        name: "Skyports",
        entry: "Floating docks ring the city.",
        keywords: ["skyport", "dock"],
        priority: 42, // eviction axis
        weight: 7, // placement axis
        enabled: true,
        comment: "internal note",
        secondaryKeys: ["harbor"],
        constant: false,
        position: "after_char",
        selectiveLogic: 2, // Agnai-only residue: never interpreted, must survive original untouched
      },
    ],
  };
}

test("agnai-lorebook detects the memory marker, not sibling shapes", () => {
  expect(agnaiLorebook.detect(asText(memoryBook()))).toBe(1);
  // kind-less but native-shaped entry array -> softer accept
  const kindless = { entries: [{ entry: "x", keywords: ["k"] }] };
  expect(agnaiLorebook.detect(asText(kindless))).toBe(0.9);
  // ST worldbook: `entries` is a keyed OBJECT, not an array
  expect(agnaiLorebook.detect(asText({ entries: { "0": { key: ["x"], content: "y" } } }))).toBe(0);
  // Risu native envelope: no top-level entries array
  expect(agnaiLorebook.detect(asText({ type: "risu", ver: 1, data: [] }))).toBe(0);
  // CCv3/Chub character_book (`keys`/`content`) is accepted as a soft import (re-emits MemoryBook)
  expect(agnaiLorebook.detect(asText({ entries: [{ content: "y", keys: ["x"] }] }))).toBe(0.7);
});

test("agnai-lorebook maps native fields, with weight->sortOrder and priority->priority", () => {
  const canon = agnaiLorebook.toCanonical(asText(memoryBook()));
  const e = canon.body.entries[0]!;
  expect(e.title).toBe("Skyports");
  expect(e.content).toBe("Floating docks ring the city.");
  expect(e.comment).toBe("internal note"); // Agnai's distinct note field, separate from the title
  expect(e.triggers.map((t) => t.keyword)).toEqual(["skyport", "dock"]);
  expect(e.triggers.every((t) => !t.isRegex)).toBe(true); // plain, never regex-promoted
  expect(e.secondaryTriggers.map((t) => t.keyword)).toEqual(["harbor"]);
  expect(e.sortOrder).toBe(7); // weight -> placement -> sortOrder
  expect(e.priority).toBe(42); // priority -> eviction -> priority
  expect(e.position).toBe("character"); // after_char
  expect(canon.body.name).toBe("Aetheria");
  expect(canon.body.lorebookType).toBe("other");
});

test("agnai-lorebook round-trips a memory book byte-identical (original-of-raw twin)", () => {
  const src = memoryBook();
  const canon = agnaiLorebook.toCanonical(asText(src));
  const out = JSON.parse(agnaiLorebook.fromCanonical(canon).text ?? "");
  // no `_id`/`userId` injected, no `scanDepth`/`tokenBudget` invented, selectiveLogic residue preserved
  expect(out).toEqual(src);
});

test("agnai-lorebook re-encodes only edited fields, preserving Agnai-only residue", () => {
  const canon = agnaiLorebook.toCanonical(asText(memoryBook()));
  const edited = structuredClone(canon);
  edited.body.entries[0]!.content = "rewritten";
  const out = JSON.parse(agnaiLorebook.fromCanonical(edited).text ?? "");
  expect(out.entries[0].entry).toBe("rewritten");
  expect(out.entries[0].weight).toBe(7); // untouched placement axis
  expect(out.entries[0].priority).toBe(42); // untouched eviction axis
  expect(out.entries[0].selectiveLogic).toBe(2); // Agnai residue survives, never interpreted
  expect(out.entries[0].keywords).toEqual(["skyport", "dock"]);
});

test("agnai-lorebook does not invent optional book fields absent from the source", () => {
  // a minimal book with no scanDepth/tokenBudget/recursiveScanning
  const minimal = { kind: "memory", name: "Bare", description: "", entries: [] };
  const canon = agnaiLorebook.toCanonical(asText(minimal));
  const out = JSON.parse(agnaiLorebook.fromCanonical(canon).text ?? "");
  expect(out).toEqual(minimal);
  expect("scanDepth" in out).toBe(false);
  expect("tokenBudget" in out).toBe(false);
});

test("cross-format: an ST worldbook writes an Agnai memory book (no-twin full encode)", () => {
  const worldbook = {
    entries: {
      "0": { uid: 0, comment: "Skyports", content: "Floating docks.", key: ["skyport"], position: 0, order: 55 },
    },
    name: "Aetheria",
  };
  const canon = stWorldbook.toCanonical(asText(worldbook)); // original keyed "sillytavern-lorebook"
  const out = JSON.parse(agnaiLorebook.fromCanonical(canon).text ?? ""); // no agnai twin -> full encode
  expect(out.kind).toBe("memory");
  expect(out.name).toBe("Aetheria");
  expect(out.entries[0].name).toBe("Skyports");
  expect(out.entries[0].entry).toBe("Floating docks.");
  expect(out.entries[0].keywords).toEqual(["skyport"]);
  expect(out.entries[0].position).toBe("before_char"); // ST position 0 -> canonical "world" -> before_char
  expect(out.entries[0].weight).toBe(55); // ST `order` (placement) -> sortOrder -> Agnai weight (#15)
  expect(out.entries[0].priority).toBe(100); // ST has no eviction axis -> Agnai priority defaults
  expect("selectiveLogic" in out.entries[0]).toBe(false); // Agnai never authors it -> not emitted
  expect("secondaryKeys" in out.entries[0]).toBe(false); // no secondary keys -> neither field emitted
  expect("selective" in out.entries[0]).toBe(false);
});

test("cross-format: secondary keys emit paired with `selective`, as Agnai's own importers do", () => {
  const worldbook = {
    entries: {
      "0": {
        uid: 0,
        comment: "Docks",
        content: "Floating docks.",
        key: ["skyport"],
        keysecondary: ["harbor", "pier"],
        position: 1,
      },
    },
    name: "Aetheria",
  };
  const canon = stWorldbook.toCanonical(asText(worldbook));
  const out = JSON.parse(agnaiLorebook.fromCanonical(canon).text ?? "");
  expect(out.entries[0].keywords).toEqual(["skyport"]);
  expect(out.entries[0].secondaryKeys).toEqual(["harbor", "pier"]); // preserved, not silently dropped
  expect(out.entries[0].selective).toBe(true); // paired, matching how Agnai emits secondary keys
});

// -- selectiveLogic de-hardcode: Agnai's field is ST-import residue on the ST numeric convention. The
// old codec hardcoded canonical "and_any", silently rewriting an imported book's secondary-key logic on
// cross-format export. --

test("selectiveLogic reads the ST numeric convention instead of hardcoding and_any", () => {
  const book = {
    kind: "memory",
    name: "st-import",
    entries: [
      { id: 1, name: "A", entry: "a", keywords: ["k"], secondaryKeys: ["s"], selective: true, selectiveLogic: 3, priority: 100, weight: 0, enabled: true },
      { id: 2, name: "B", entry: "b", keywords: ["k"], priority: 100, weight: 1, enabled: true },
    ],
  };
  const canon = agnaiLorebook.toCanonical(asText(book));
  expect(canon.body.entries[0]!.selectiveLogic).toBe("and_all"); // 3
  expect(canon.body.entries[1]!.selectiveLogic).toBe("and_any"); // absent -> default
});

test("selectiveLogic edit reaches the wire; unedited twin residue stays byte-identical", () => {
  const book = {
    kind: "memory",
    name: "st-import",
    description: "", // the codec (like Agnai's own encodeBook) always emits description
    entries: [
      { id: 1, name: "A", entry: "a", keywords: ["k"], secondaryKeys: ["s"], selective: true, selectiveLogic: 3, priority: 100, weight: 0, enabled: true },
    ],
  };
  const canon = agnaiLorebook.toCanonical(asText(book));
  // unedited: byte-identical (the explicit 3 survives via the twin)
  expect(JSON.parse(agnaiLorebook.fromCanonical(canon).text!)).toEqual(book);
  // edited: the new logic lands on the wire as its ST number
  canon.body.entries[0]!.selectiveLogic = "not_any";
  const out = JSON.parse(agnaiLorebook.fromCanonical(canon).text!);
  expect(out.entries[0].selectiveLogic).toBe(2);
});
