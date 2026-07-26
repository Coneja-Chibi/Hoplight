/**
 * CLI validation boundary. Adapter output is still untrusted until the exhaustive canonical runtime
 * schema accepts it, so `hoplight validate` cannot mistake a permissive adapter parse for validity.
 */
import type { AdapterInput, FormatAdapter } from "./core";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "./entities/runtime-schema";

/** Convert through one detected adapter and enforce the complete canonical envelope and body schema. */
export function validateAdapterOutput(
  adapter: FormatAdapter,
  input: AdapterInput,
): ParsedCanonicalEntity {
  const parsed = parseCanonicalEntity(adapter.toCanonical(input));
  if (parsed.kind !== adapter.kind) {
    throw new Error(
      `${adapter.id}: adapter declared kind "${adapter.kind}" but produced "${parsed.kind}"`,
    );
  }
  return parsed;
}
