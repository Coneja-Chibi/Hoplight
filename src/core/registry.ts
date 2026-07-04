/**
 * The registry - the pure, in-memory adapter table (no filesystem, no runtime deps).
 * Auto-discovery of format folders lives in ./loader (the impure edge) so this core stays pure.
 *
 * To add a format: drop a folder in src/formats/. The loader finds it; nothing here changes.
 */
import type { FormatAdapter, AdapterInput } from "./adapter";

/** Confidence an adapter must clear before detect() will claim an input. */
const DETECT_THRESHOLD = 0.5;

const adapters = new Map<string, FormatAdapter>();

/** Add (or replace) an adapter in the table, keyed by its id. */
export function register(adapter: FormatAdapter): void {
  adapters.set(adapter.id, adapter);
}

/** Look up a registered adapter by id. */
export function get(id: string): FormatAdapter | undefined {
  return adapters.get(id);
}

/** Every registered adapter. */
export function all(): FormatAdapter[] {
  return [...adapters.values()];
}

/** Highest-confidence adapter that clears the detection threshold, or undefined. */
export function detect(input: AdapterInput): FormatAdapter | undefined {
  let best: FormatAdapter | undefined;
  let score = 0;
  for (const adapter of adapters.values()) {
    const s = adapter.detect(input);
    if (s > score) {
      score = s;
      best = adapter;
    }
  }
  return score >= DETECT_THRESHOLD ? best : undefined;
}

/** Adapters that write the given file extension (no dot). Zero, one, or (ambiguously) many. */
export function targetsForExtension(ext: string): FormatAdapter[] {
  const e = ext.toLowerCase();
  return all().filter((a) => a.outputExtensions.includes(e));
}
