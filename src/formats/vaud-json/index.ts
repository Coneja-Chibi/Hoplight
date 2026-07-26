/**
 * vaud-json - Hoplight's own native format: the canonical entity as plain JSON. The adapter id
 * stays "vaud-json" for data compatibility (escrow keys and stored originals reference it).
 * The simplest possible real adapter, and proof the drop-in pattern works end to end.
 * It is also genuinely useful: the lossless local save/interchange format.
 */
import type { CharacterAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { parseCanonicalEntity } from "../../entities/runtime-schema";

function decodeCanonical(text: string): CanonicalCharacter {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("vaud-json: invalid JSON");
  }
  try {
    const entity = parseCanonicalEntity(parsed);
    if (entity.kind !== "character") throw new Error();
    return entity;
  } catch {
    throw new Error("vaud-json: invalid canonical character");
  }
}

const adapter: CharacterAdapter = {
  id: "vaud-json",
  label: "Hoplight native (.json)",
  outputExtensions: ["json"],
  kind: "character",
  native: true, // Hoplight's own storage format: importable/exportable, never a "publish to" platform

  detect(input: AdapterInput): number {
    if (!input.text) return 0;
    try {
      return parseCanonicalEntity(JSON.parse(input.text)).kind === "character" ? 1 : 0;
    } catch {
      return 0;
    }
  },

  toCanonical(input: AdapterInput): CanonicalCharacter {
    if (!input.text) throw new Error("vaud-json: needs text input");
    return decodeCanonical(input.text);
  },

  fromCanonical(entity: CanonicalCharacter): AdapterOutput {
    return { text: JSON.stringify(entity, null, 2), suggestedExtension: "json" };
  },
};

export default adapter;
