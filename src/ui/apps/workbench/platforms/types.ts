/**
 * The one-file-per-platform model. A platform is declared in a single file as the list of fields its
 * card can hold, in display order. There is no "native vs canonical" tier: a field is just a label, a
 * place its value lives, and the control that edits it. Common fields (name, description, ...) are
 * defined ONCE in the shared catalog (fields.ts) and a platform names them by id; a field unique to a
 * platform is spelled out inline in that platform's own file. Pick platforms in the editor and it shows
 * the union of their fields, deduped, common ones once. Adding a platform is dropping in one file.
 */
import type { FieldModule } from "../fields";
import type { NativeControl } from "../../../components/native-card";

/**
 * A field a platform defines itself, because no other platform shares it. Same idea as a common field
 * (label + where the value lives + control), except its value lives in the kept-whole imported original
 * (`entity.original.<path>`), not the canonical body.
 */
export interface OwnField {
  /** stable id, unique across the catalog and every platform's own fields */
  id: string;
  label: string;
  /** dot path into entity.original (e.g. "sillytavern.raw.data.extensions.talkativeness") */
  path: string;
  control: NativeControl;
  help?: string;
  /** `slider` bounds */
  slider?: { min: number; max: number; step?: number };
  /** `raw-extensions` only: keys handled elsewhere, kept out of the catch-all */
  hide?: readonly string[];
}

/** One entry in a platform's field list: a common field named by id, or a field it defines itself. */
export type FieldRef = string | OwnField;

/** A platform, declared in one file: everything its card can hold, in the order the editor should show. */
export interface Platform {
  /** the original key this platform stores under (matches entity.original.<key>) */
  key: string;
  label: string;
  fields: readonly FieldRef[];
}

/**
 * A resolved, renderable field. The editor renders both variants the same way; only the store differs:
 * a common field reads/writes the canonical body, an own field reads/writes the kept-whole original.
 */
export type ResolvedField =
  | { source: "common"; id: string; module: FieldModule }
  | { source: "own"; id: string; field: OwnField };
