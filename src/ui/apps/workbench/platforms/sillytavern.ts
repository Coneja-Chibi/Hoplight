/**
 * SillyTavern's native schema - the extras SillyTavern keeps in its own card (data.extensions and a
 * couple of data.* siblings) that don't map to a canonical common field. Each field names a dot path
 * INTO the entity's kept-whole original (relative to `entity.original`) and the control that edits it.
 * Verified against the stored shape + the CCv3 spec, never guessed. Approved wireframe:
 * design/vs-native-sillytavern.html.
 *
 * One platform per file (folders-as-schema): to compare platforms you read them side by side; to add
 * one you drop a sibling file and register it in ./index.
 */
import type { NativeSchema } from "../../../components/native-card";

const sillytavern: NativeSchema = {
  key: "sillytavern",
  label: "SillyTavern",
  // talkativeness (settings.talkativeness) and the character's-note depth_prompt (prompts.depthInjections)
  // are CANONICAL per coverage AND have canonical cards in the shared layout, so they are NOT declared
  // here - that was the duplication (they rendered twice). world (worldName) and assets (media.assets)
  // are carried too but have NO canonical card yet, so they stay native below to remain editable.
  fields: [
    {
      path: "sillytavern.raw.data.extensions.fav",
      label: "Favorite",
      control: "toggle",
      help: "Starred in SillyTavern's character list.",
    },
    {
      path: "sillytavern.raw.data.character_book",
      label: "Character Book",
      control: "lorebook-link",
      help: "An embedded lorebook. Lorebooks are their own editor in Hoplight.",
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
      help: "Card-scoped find/replace rules. Regex is its own editor in Hoplight.",
    },
    {
      path: "sillytavern.raw.data.assets",
      label: "Assets",
      control: "asset-manager",
      help: "Portraits, backgrounds, an emotion pack, user icons, audio. Drop a file to embed it.",
    },
    {
      // the crumb net: every extensions key not owned by a field above stays editable here
      path: "sillytavern.raw.data.extensions",
      label: "Other extension data",
      control: "raw-extensions",
    },
  ],
};

export default sillytavern;
