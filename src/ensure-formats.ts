/**
 * One owner for "make the format registry ready in whatever runtime this is". A compiled binary
 * cannot glob src/formats, so a packaged build (PACKAGED_ASSETS baked non-null) uses the static
 * registry generated in the same bake; a source checkout keeps drop-in loading.
 *
 * This lives at the app layer, beside convert.ts, for the same reason convert.ts does: it is the
 * layer that already wires adapters together, and src/core must not reach up into src/generated.
 * Idempotent and safe to await from several call sites; concurrent callers share one load.
 */
import { loadFormats } from "./core";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";
import { registerPackagedFormats } from "./generated/packaged-formats";

let ready: Promise<void> | null = null;

/** Register every format adapter exactly once for this process. */
export function ensureFormats(): Promise<void> {
  ready ??= (async () => {
    if (PACKAGED_ASSETS !== null) registerPackagedFormats();
    else await loadFormats();
  })();
  return ready;
}
