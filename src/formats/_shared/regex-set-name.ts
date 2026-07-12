/**
 * Derive a regex SET's display name from the imported file's name. Shared by every regex adapter
 * shell: none of the five dialects' standalone files carry a container name on the wire (Lumiverse's
 * envelope and RoleCall's script object are the exceptions, and their adapters prefer the wire name
 * when present), so the filename base is the honest source. Extracted once from the SillyTavern
 * regex codec's original private helper (shared-once doctrine).
 */
import type { AdapterInput } from "../../core/adapter";

/** Filename base (extension and directories stripped), or `fallback` when input has no filename. */
export function setNameFromFilename(input: AdapterInput, fallback: string): string {
  const filename = input.filename;
  if (filename) {
    const base = filename.replace(/\.[^./\\]+$/, "").split(/[\\/]/).pop();
    if (base) return base;
  }
  return fallback;
}
