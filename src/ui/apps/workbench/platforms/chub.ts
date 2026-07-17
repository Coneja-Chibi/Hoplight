/**
 * Chub (Chub.ai / CharacterHub / Venus) native schema.
 * Path: sillytavern.raw.data.extensions.chub.* (namespaced bag on ST CCv2/v3).
 *
 * Main-page fields are things you actually author here: background, lore refs, CSS, preset.
 * Hub cargo (Stages, path, id) and sprites stay on the twin for export but are HIDE'd - no empty
 * JSON boxes or provenance dead-ends on the main surface.
 *
 * Plan: docs/CHUB-JEWEL-PLAN.md · Wireframe: design/vs-native-chub.html
 */
import type { NativeSchema } from "../../../components/native-card";

const CHUB = "sillytavern.raw.data.extensions.chub";

/**
 * Listed elsewhere or not a main-card concern. Still on the twin; catch-all does not re-list them.
 */
const HIDE = [
  "background_image",
  "expressions",
  "alt_expressions",
  "related_lorebooks",
  "custom_css",
  "preset",
  // hub cargo / provenance - re-export keeps them; main page does not host empty shells
  "extensions",
  "full_path",
  "id",
] as const;

const chub: NativeSchema = {
  key: "chub",
  label: "Chub",
  fields: [
    {
      path: `${CHUB}.background_image`,
      label: "Chat background",
      control: "url",
      help: "Image URL behind chat (Chub CDN or your own).",
    },
    {
      path: `${CHUB}.related_lorebooks`,
      label: "Related lorebooks",
      control: "json",
      help:
        "JSON array of Chub lore refs: [{id, path, version, commit_ref?}]. " +
        "Not full books on the card. Full lore library later. Invalid JSON keeps the prior value.",
    },
    {
      path: `${CHUB}.custom_css`,
      label: "Custom CSS",
      control: "css-workshop",
      cssPack: "chub-card",
      help:
        "Chub page styling as plain CSS. Sealed preview only in Vaude; never applied to the app.",
    },
    {
      path: `${CHUB}.preset`,
      label: "Bound preset",
      control: "text",
      help: "Hub/catalog generation preset ref. Full preset entity is a later content type.",
    },
    {
      path: CHUB,
      label: "Other Chub data",
      control: "raw-extensions",
      hide: HIDE,
    },
  ],
};

export default chub;
