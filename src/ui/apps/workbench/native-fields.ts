/**
 * Native-field schemas - the editable "everything else" a platform keeps to itself, the fields that
 * used to sit frozen. Each field names a dot path INTO the entity's kept-whole original (relative to
 * `entity.original`, e.g. "sillytavern.raw.data.extensions.talkativeness") and the control that edits
 * it. The editor renders a card per platform present in the original, binding each field to the
 * originalDraft through the same readPath/writePath it uses everywhere - editing writes straight back
 * into the original and re-emits on export.
 *
 * Grown one VERIFIED platform at a time (structure checked against the real stored shape + the
 * platform's own spec, never guessed - a wrong path silently edits nothing). Approved wireframe:
 * design/vs-native-sillytavern.html.
 */

// the schema types live in the leaf component (components/native-card); the DATA lives here
import type { NativeSchema } from "../../components/native-card";

/** SillyTavern's own extras (data.extensions), verified against the stored shape + CCv3 spec. */
const SILLYTAVERN: NativeSchema = {
  key: "sillytavern",
  label: "SillyTavern",
  fields: [
    {
      path: "sillytavern.raw.data.extensions.talkativeness",
      label: "Talkativeness",
      control: "slider",
      slider: { min: 0, max: 1, step: 0.05 },
      help: "How eagerly they jump into a group chat, 0 to 1.",
    },
    {
      path: "sillytavern.raw.data.extensions.fav",
      label: "Favorite",
      control: "toggle",
      help: "Starred in SillyTavern's character list.",
    },
    {
      path: "sillytavern.raw.data.extensions.depth_prompt",
      label: "Character's Note",
      control: "note",
      help: "A note injected at a fixed depth every turn, to keep a trait from drifting.",
    },
    {
      path: "sillytavern.raw.data.character_book",
      label: "Character Book",
      control: "lorebook-link",
      help: "An embedded lorebook. Lorebooks are their own editor in Vaude.",
    },
    {
      path: "sillytavern.raw.data.extensions.world",
      label: "Linked world",
      control: "world-link",
      help: "A lorebook SillyTavern binds to this card by name.",
    },
    {
      path: "sillytavern.raw.data.extensions.regex_scripts",
      label: "Regex scripts",
      control: "regex-link",
      help: "Card-scoped find/replace rules. Regex is its own editor in Vaude.",
    },
  ],
};

export const NATIVE_SCHEMAS: readonly NativeSchema[] = [SILLYTAVERN];

/** The native schema for an original key, or undefined when that platform has none declared yet. */
export const nativeSchemaFor = (key: string): NativeSchema | undefined =>
  NATIVE_SCHEMAS.find((s) => s.key === key);
