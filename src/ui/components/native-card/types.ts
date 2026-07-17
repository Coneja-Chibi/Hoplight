/**
 * Native field schema types and host context for platform-native card controls.
 */
import type { JSX } from "react";

/** an open stub-editor request: what to show while the real content-type editor does not exist yet */
export interface Stub {
  title: string;
  note: string;
  view: JSX.Element;
}

/** Which reusable control renders a native field. Grown as each approved component lands. */
export type NativeControl =
  | "slider"
  | "toggle"
  | "note"
  | "lorebook-link" // an embedded lorebook object -> link to the Lorebook editor
  | "world-link" // a lorebook bound by name -> link to the Lorebook editor
  | "regex-link" // regex scripts array -> link to the Regex editor
  | "asset-manager" // data.assets[] -> the type-grouped media manager
  | "tracker-setup" // RoleCall trackerPreset -> the tracker module + seed editor
  | "recommendations" // RoleCall recommendations -> the 4-group bundle editor
  | "text" // a single line of text (a code, a name)
  | "textarea" // multi-line free text (a backstory, a long note)
  | "rpg-stats" // character RPGStatsConfig: enabled + attributes + hp (no pools)
  | "avatar-crop" // Marinara source-rect crop {srcX,srcY,srcWidth,srcHeight}
  | "tracker-card-colors" // Marinara trackerCardColors paint config
  | "expression-map" // Lumiverse expressions {enabled,default,mappings}
  | "expression-groups" // Lumiverse multi-char expression packs
  | "alt-fields" // Lumiverse alternate_fields per description/personality/scenario
  | "portable-lora" // Lumiverse lumiverse_image_gen_lora card hint
  | "color" // theming color: swatches + free CSS (hex or gradient)
  | "url" // a URL
  | "css-workshop" // assisted CSS string editor (sealed preview; never applied to chrome)
  | "json" // object/array as pretty JSON text (parse on write; fail closed keeps prior)
  | "read-only" // shown but not editable (account-level / derived fields)
  | "raw-extensions"; // the catch-all: every leftover key in this object, editable
// Body-only Agnai-led controls (voice, structured persona, image prompt, sprite, response schema)
// live on FIELD_MODULES + field-control - never re-declared here (RC/ST rule).

export interface NativeField {
  /** dot path relative to entity.original */
  path: string;
  label: string;
  control: NativeControl;
  help?: string;
  slider?: { min: number; max: number; step?: number };
  /** css-workshop: default target pack id */
  cssPack?: string;
  /** raw-extensions only: extra keys to hide (already handled elsewhere, e.g. canonical fields) */
  hide?: readonly string[];
}

export interface NativeSchema {
  key: string;
  label: string;
  /** original-bound leftovers only; shared character fields stay on FIELD_MODULES (RC/ST rule) */
  fields: NativeField[];
}

/** Optional host context for native controls that need body assets (e.g. face for crop). */
export interface NativeFieldContext {
  /** media.portrait.ref when present (data URI or URL) */
  portraitSrc?: string;
  /** Handoff from AssetManager expression group to Manage Sprites */
  onOpenSprites?: () => void;
}
