/**
 * vaud-json - Vaudeville's own native format: the canonical entity as plain JSON.
 * The simplest possible real adapter, and proof the drop-in pattern works end to end.
 * It is also genuinely useful: the lossless local save/interchange format.
 */
import type { FormatAdapter, AdapterInput, AdapterOutput } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";

/** Decode + validate at the boundary (parse, don't validate): fail here, not deep downstream. */
function decodeCanonical(text: string): CanonicalCharacter {
  const o = JSON.parse(text) as Partial<CanonicalCharacter>;
  if (o?.kind !== "character" || typeof o.schemaVersion !== "string") {
    throw new Error("vaud-json: not a canonical character (missing kind/schemaVersion)");
  }
  if (!o.body || typeof o.body !== "object" || typeof o.body.identity?.name !== "string") {
    throw new Error("vaud-json: malformed canonical character (missing body.identity.name)");
  }
  return o as CanonicalCharacter;
}

const adapter: FormatAdapter = {
  id: "vaud-json",
  label: "Vaudeville native (.json)",
  outputExtensions: ["json"],

  detect(input: AdapterInput): number {
    if (!input.text) return 0;
    try {
      const o = JSON.parse(input.text) as Partial<CanonicalCharacter>;
      return o?.kind === "character" && typeof o?.schemaVersion === "string" ? 1 : 0.1;
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
