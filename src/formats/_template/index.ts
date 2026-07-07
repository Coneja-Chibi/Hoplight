/**
 * FORMAT TEMPLATE - copy me to add a new format.
 *
 *   cp -r src/formats/_template src/formats/myformat
 *   fill in the three verbs below, done. No core edits, nothing to register.
 *
 * Folders starting with "_" are skipped by the loader, so this template stays inert.
 */
import type { CharacterAdapter } from "../../core/adapter";

const adapter: CharacterAdapter = {
  id: "template",
  label: "Template (copy me)",
  outputExtensions: ["txt"],
  kind: "character", // or "lorebook" - the entity kind this format reads/writes

  /** 0..1: how sure are you this input is your format? */
  detect(): number {
    return 0;
  },

  /** read the file INTO the canonical model; stash originals + unmapped fields in original */
  toCanonical() {
    throw new Error("template is not a real format - copy this folder and implement it");
  },

  /** write the canonical entity OUT to your format; re-emit your original for round-trip */
  fromCanonical() {
    return { text: "", suggestedExtension: "txt" };
  },
};

export default adapter;
