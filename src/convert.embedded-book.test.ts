/**
 * Where a card's embedded lorebook lives after import, and which copy is the live one.
 *
 * REPORTED FROM THE FIELD (GeBo, 2026-08-07): "a kit gets confused if the card was imported with an
 * embedded lorebook and you update it. The embedded one in the character seems to stay outdated and
 * the lorebook is now standalone... It seems to correctly update on export, but kit is still seeing
 * the old data if it loads the character."
 *
 * There are genuinely two copies after import, and that is CORRECT rather than the bug. The first
 * remedy tried here was deleting the character's copy, and an existing test caught why that is
 * wrong: emitBundle called without resolved lorebooks has nothing else to re-embed from, so
 * removing it turns "the caller did not resolve the refs" into a card that silently exports with no
 * lore at all. See convert.test.ts, "preserves the twin when lorebook resolution was not supplied".
 *
 * So the embedded copy stays, as the export fallback, and the rule these pin is which copy is
 * AUTHORITATIVE: the standalone book behind knowledgeRefs. The reading half of the fix is in
 * kit/tools/read-stale-book.test.ts, where the stale copy was being handed to a model.
 */
import { describe, expect, test } from "bun:test";
import { inspectBundle } from "./convert";
import type { AdapterInput, CharacterAdapter } from "./core";
import { toAdapterInput } from "./core/adapter-input";
import sillytavern from "./formats/sillytavern";

const CARD = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Ludovic",
    description: "a field agent",
    first_mes: "hello",
    character_book: {
      name: "Ludovic's notes",
      entries: [{ keys: ["harbor"], content: "THE ORIGINAL TEXT", insertion_order: 0 }],
    },
  },
};

const adapter = sillytavern[0] as CharacterAdapter;

const inputFor = (card: unknown, name = "ludovic.json"): AdapterInput =>
  toAdapterInput(new TextEncoder().encode(JSON.stringify(card)), name);

const rawOf = (original: unknown): Record<string, unknown> | undefined => {
  const box = original as Record<string, { raw?: Record<string, unknown> }> | undefined;
  return box ? Object.values(box)[0]?.raw : undefined;
};

describe("importing a card with an embedded book", () => {
  test("the book comes out standalone and the character points at it", () => {
    const { entity, lorebooks } = inspectBundle(adapter, inputFor(CARD));

    expect(lorebooks).toHaveLength(1);
    expect(lorebooks[0]?.body.entries[0]?.content).toBe("THE ORIGINAL TEXT");
    expect(entity.body.knowledgeRefs).toHaveLength(1);
    expect(entity.body.knowledgeRefs?.[0]).toBe(lorebooks[0]?.id ?? "");
  });

  test("THE EMBEDDED COPY STAYS, because it is the export fallback", () => {
    /**
     * It looks like a duplicate worth deleting. It is not: an export that was never handed the
     * resolved lorebooks re-embeds from this twin, and without it that export ships a card with no
     * lore and no error. Keeping it is the safe half; the unsafe half was letting a READER see it.
     */
    const card = rawOf(inspectBundle(adapter, inputFor(CARD)).entity.original);
    const data = card?.["data"] as Record<string, unknown> | undefined;
    expect(data?.["character_book"]).toBeDefined();
  });

  test("THE RAW BOOK ALSO RIDES ON THE LOREBOOK, which is the twin a resolved export uses", () => {
    // Two twins for two paths: the lorebook's own raw for a resolved re-embed, the character's for
    // the unresolved fallback. The lorebook's is the one that stays in step with edits.
    const { lorebooks } = inspectBundle(adapter, inputFor(CARD));
    const twin = lorebooks[0]?.original as { "character-book"?: { raw?: unknown } } | undefined;
    expect(twin?.["character-book"]?.raw).toBeDefined();
  });

  test("KNOWLEDGEREFS IS WHAT SAYS WHICH COPY IS LIVE", () => {
    /**
     * The whole contract in one assertion. Once this is set, the standalone piece it names is the
     * authority and the embedded copy is a frozen snapshot for re-export. Anything that reads lore
     * for a person or a model must follow this ref, never the raw.
     */
    const { entity, lorebooks } = inspectBundle(adapter, inputFor(CARD));
    expect(entity.body.knowledgeRefs?.[0]).toBe(lorebooks[0]?.id ?? "");
  });

  test("a card with no book keeps its raw exactly as it came", () => {
    const plain = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: { name: "Nobody", description: "", first_mes: "hi" },
    };
    const { entity, lorebooks } = inspectBundle(adapter, inputFor(plain, "nobody.json"));

    expect(lorebooks).toHaveLength(0);
    expect(rawOf(entity.original)).toEqual(plain);
  });
});
