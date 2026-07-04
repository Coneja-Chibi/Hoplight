/**
 * FORMAT TEMPLATE - copy me to add a new format.
 *
 *   cp -r src/formats/_template src/formats/myformat
 *   fill in the three verbs below, done. No core edits, nothing to register.
 *
 * Folders starting with "_" are skipped by the loader, so this template stays inert.
 */
import type { FormatAdapter } from "../../core/adapter";

const adapter: FormatAdapter = {
  id: "template",
  label: "Template (copy me)",
  outputExtensions: ["txt"],

  /** 0..1: how sure are you this input is your format? */
  detect(): number {
    return 0;
  },

  /** read the file INTO the canonical model; stash originals + unmapped fields in escrow */
  toCanonical() {
    throw new Error("template is not a real format - copy this folder and implement it");
  },

  /** write the canonical entity OUT to your format; re-emit your escrow for round-trip */
  fromCanonical() {
    return { text: "", suggestedExtension: "txt" };
  },
};

export default adapter;
