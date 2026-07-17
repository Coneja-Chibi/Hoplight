/**
 * Lumiverse native schema. Bare data.extensions keys (no .lumiverse bag) on an ST CCv2/v3 card.
 * alternate_fields / alternate_avatars → body.variants (VariantStrip).
 * expressions / expression_groups → Manage Sprites / media.assets (not listed here).
 * Twin keeps expression bytes for export; HIDE keeps them out of the catch-all dump.
 * Plan: docs/LUMIVERSE-JEWEL-PLAN.md. Wireframe: design/vs-native-lumiverse.html.
 */
import type { NativeSchema } from "../../../components/native-card";

const EXT = "sillytavern.raw.data.extensions";

const HIDE = [
  "alternate_character_name",
  // body.variants bridge
  "alternate_fields",
  "alternate_avatars",
  // sprite home is Manage Sprites — no main-page stub boxes
  "expressions",
  "expression_groups",
  "lumiverse_image_gen_lora",
  "ttsVoice",
  "world_book_ids",
  "world_book_id",
  "databank_ids",
  "character_book",
  "avatar_crop_image_id",
  "original_image_id",
  "_lumiverse_source_filename",
  "_lumiverse_install_source",
  "_lumiverse_install_slug",
  "_lumiverse_chub_slug",
  "risu_asset_map",
  "_lumiverse_modules_world_books",
  "_lumiverse_modules_regex_scripts",
] as const;

const lumiverse: NativeSchema = {
  key: "lumiverse",
  label: "Lumiverse",
  fields: [
    {
      path: `${EXT}.alternate_character_name`,
      label: "Alternate character name",
      control: "text",
      help: "Prompt / macro name override. Library name stays on the body. Prose/face alts use the portrait variant strip (Base +).",
    },
    {
      path: `${EXT}.lumiverse_image_gen_lora`,
      label: "Image LoRA (portable)",
      control: "portable-lora",
      help: "Card-side LoRA hint. Does not install weights. Never auto-downloads the URL.",
    },
    {
      path: `${EXT}.ttsVoice`,
      label: "TTS voice",
      control: "text",
      help: "Bound voice ref from Lumiverse. Preserved as text; no live TTS in the forge.",
    },
    {
      path: `${EXT}.world_book_ids`,
      label: "Attached world books",
      control: "read-only",
      help: "Lorebook ids on the card. Full lore editor is a later content type. IDs survive on the twin.",
    },
    {
      path: `${EXT}.databank_ids`,
      label: "Attached databanks",
      control: "read-only",
      help: "Databank ids. Full databank editor later.",
    },
    {
      path: EXT,
      label: "Other Lumiverse extension data",
      control: "raw-extensions",
      hide: HIDE,
    },
  ],
};

export default lumiverse;
