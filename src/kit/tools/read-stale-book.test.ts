/**
 * What a model is shown when it reads a character that had an embedded lorebook.
 *
 * REPORTED FROM THE FIELD (GeBo, 2026-08-07): "a kit gets confused if the card was imported with an
 * embedded lorebook and you update it. The embedded one in the character seems to stay outdated and
 * the lorebook is now standalone... It seems to correctly update on export, but kit is still seeing
 * the old data if it loads the character."
 *
 * Export was right; reading was not. `studio_read` handed over the whole canonical entity, and a
 * canonical entity carries `original` - the raw file it was imported from, kept so a re-export can
 * be byte-faithful. For a card that had an embedded book, that raw still holds the book as it was
 * ON THE DAY OF IMPORT. So the model was handed the current character, the current knowledgeRefs,
 * AND a stale copy of the lore, with nothing marking which was which. It reasonably read the copy
 * that had actual entries in it.
 *
 * `original` is ballast for the writer, not content for a reader. It should never have been in
 * front of a model.
 */
import { describe, expect, test } from "bun:test";
import { inspectBundle } from "../../convert";
import { toAdapterInput } from "../../core/adapter-input";
import type { CharacterAdapter } from "../../core";
import sillytavern from "../../formats/sillytavern";
import readTool from "./read";
import type { KitBridge, KitEntity } from "../bridge";

const CARD = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Ludovic",
    description: "a field agent",
    first_mes: "hello",
    character_book: {
      name: "Ludovic's notes",
      entries: [{ keys: ["harbor"], content: "STALE TEXT FROM IMPORT DAY", insertion_order: 0 }],
    },
  },
};

/** The character exactly as import leaves it: linked to a standalone book, raw twin still aboard. */
function importedCharacter(): KitEntity {
  const adapter = sillytavern[0] as CharacterAdapter;
  const input = toAdapterInput(new TextEncoder().encode(JSON.stringify(CARD)), "ludovic.json");
  return inspectBundle(adapter, input).entity as unknown as KitEntity;
}

const bridgeWith = (entity: KitEntity): KitBridge =>
  ({ read: () => Promise.resolve(entity) }) as unknown as KitBridge;

async function readCharacter(): Promise<string> {
  const result = await readTool.execute(
    { kind: "character", id: "ludovic" },
    { bridge: bridgeWith(importedCharacter()) } as unknown as Parameters<typeof readTool.execute>[1],
  );
  return result.output;
}

describe("studio_read on a character that had an embedded book", () => {
  test("THE STALE EMBEDDED LORE IS NOT PUT IN FRONT OF THE MODEL", async () => {
    /**
     * The reported confusion, exactly. The standalone book is the live one; the copy inside
     * `original` is a snapshot from import. Handing over both, unlabelled, is why the model
     * answered from the old text.
     */
    const output = await readCharacter();
    expect(output).not.toContain("STALE TEXT FROM IMPORT DAY");
    expect(output).not.toContain("character_book");
  });

  test("the character's own fields still come through", async () => {
    // Removing the raw must not remove the piece. What a reader wants is the canonical body.
    const output = await readCharacter();
    expect(output).toContain("Ludovic");
    expect(output).toContain("a field agent");
  });

  test("THE LINK TO THE LIVE BOOK SURVIVES, so the model can go and read it", async () => {
    /**
     * This is what makes the removal an improvement rather than a subtraction: knowledgeRefs names
     * the standalone lorebook, and reading that gives current entries. The model is not left
     * without the lore, it is pointed at the copy that is true.
     */
    const output = await readCharacter();
    expect(output).toContain("knowledgeRefs");
    expect(output).toContain("ludovic-s-notes");
  });
});
