import { test, expect } from "bun:test";
import { characterAdapter as adapter } from "./index";
import agnaiLorebook from "./lorebook";
import stWorldbook from "../sillytavern/lorebook";
import { convertFile } from "../../convert";

const asText = (c: unknown) => ({ text: JSON.stringify(c) });

/** An Agnai native character whose native download carries an embedded `characterBook` (a MemoryBook). */
function cardWithBook() {
  return {
    kind: "character",
    name: "Vera",
    persona: { kind: "text", attributes: { text: ["curious"] } },
    greeting: "You again.",
    scenario: "at a crossroads inn",
    sampleChat: "",
    characterBook: {
      kind: "memory",
      name: "Vera's lore",
      description: "",
      entries: [
        { name: "Inn", entry: "A cozy crossroads inn.", keywords: ["inn"], priority: 10, weight: 3, enabled: true },
      ],
    },
  };
}

/** The same Agnai native character with NO embedded book. */
function cardNoBook() {
  return {
    kind: "character",
    name: "Vera",
    persona: { kind: "text", attributes: { text: ["curious"] } },
    greeting: "You again.",
    scenario: "at a crossroads inn",
    sampleChat: "",
  };
}

test("extractLorebook pulls the native characterBook, mapping both axes", () => {
  const entity = adapter.toCanonical(asText(cardWithBook()));
  const lb = adapter.extractLorebook!(entity);
  expect(lb).not.toBeNull();
  const e = lb!.body.entries[0]!;
  expect(e.title).toBe("Inn");
  expect(e.content).toBe("A cozy crossroads inn.");
  expect(e.triggers.map((t) => t.keyword)).toEqual(["inn"]);
  expect(e.sortOrder).toBe(3); // weight -> placement
  expect(e.priority).toBe(10); // priority -> eviction
});

test("convertFile carries the embedded book across as a linked lorebook + knowledgeRef", () => {
  const { lorebooks } = convertFile(adapter, adapter, asText(cardWithBook()));
  expect(lorebooks.length).toBe(1);
  expect(lorebooks[0]!.body.entries[0]!.title).toBe("Inn");
});

test("container-invariance: standalone memory book == embedded characterBook, canonically", () => {
  const book = cardWithBook().characterBook;
  const standalone = agnaiLorebook.toCanonical(asText(book)).body;
  const embedded = adapter.extractLorebook!(adapter.toCanonical(asText(cardWithBook())))!.body;
  expect(embedded).toEqual(standalone); // same mapper, so identical by construction
});

test("agnai -> agnai round-trips a card WITH its book byte-identical", () => {
  const src = cardWithBook();
  const { out } = convertFile(adapter, adapter, asText(src));
  expect(JSON.parse(out.text ?? "")).toEqual(src); // characterBook re-emits via its original twin
});

test("cross-format re-embed: a foreign lorebook writes into card.characterBook (no twin, full encode)", () => {
  const charEntity = adapter.toCanonical(asText(cardNoBook()));
  const worldbook = {
    entries: {
      "0": { uid: 0, comment: "Docks", content: "Floating docks.", key: ["dock"], keysecondary: ["harbor"], position: 1, order: 5 },
    },
    name: "Aetheria",
  };
  const lb = stWorldbook.toCanonical(asText(worldbook)); // original keyed sillytavern-lorebook, no agnai twin
  const out = adapter.fromCanonical(charEntity, { lorebooks: [lb] });
  const card = JSON.parse(out.text ?? "");
  expect(card.characterBook.kind).toBe("memory");
  expect(card.characterBook.entries[0].name).toBe("Docks");
  expect(card.characterBook.entries[0].entry).toBe("Floating docks.");
  expect(card.characterBook.entries[0].keywords).toEqual(["dock"]);
  expect(card.characterBook.entries[0].secondaryKeys).toEqual(["harbor"]);
  expect(card.characterBook.entries[0].selective).toBe(true); // paired, per the codec's convention
});

test("a card with no characterBook extracts nothing and never gets an empty book injected", () => {
  const entity = adapter.toCanonical(asText(cardNoBook()));
  expect(adapter.extractLorebook!(entity)).toBeNull();

  const { out, lorebooks } = convertFile(adapter, adapter, asText(cardNoBook()));
  expect(lorebooks.length).toBe(0);
  expect("characterBook" in JSON.parse(out.text ?? "")).toBe(false);
});
