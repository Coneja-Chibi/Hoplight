/**
 * RoleCall's native schema. Most of RoleCall is canonical (Hoplight was seeded from it); these are the
 * native-only fields it keeps in data.extensions.rolecall (plus its own character_book). Paths into
 * `entity.original`. Verified from RC source (serialize-v2.ts, tracker-presets.ts). Approved wireframe:
 * design/vs-native-rolecall.html.
 *
 * One platform per file (folders-as-schema): read it beside ./sillytavern to audit where they align.
 */
import type { NativeSchema } from "../../../components/native-card";

/** everything RoleCall stashes under the SillyTavern card's extensions.rolecall block */
const RC_EXT = "rolecall.raw.data.extensions.rolecall";

const rolecall: NativeSchema = {
  key: "rolecall",
  label: "RoleCall",
  fields: [
    {
      path: `${RC_EXT}.recommendations`,
      label: "Recommendations",
      control: "recommendations",
      help: "Presets, lorebooks, regexes, and personas this character recommends pairing with.",
    },
    {
      path: `${RC_EXT}.trackerPreset`,
      label: "Tracker Setup",
      control: "tracker-setup",
      help: "Which immersion trackers this story wants, and their starting values.",
    },
    {
      path: "rolecall.raw.data.character_book",
      label: "Character Book",
      control: "lorebook-link",
      help: "This character's own embedded lorebook (distinct from the lorebooks it recommends).",
    },
    { path: `${RC_EXT}.loadout`, label: "Loadout code", control: "text", help: "A RoleCall preset/config code the card ships with." },
    {
      path: RC_EXT,
      label: "Other RoleCall data",
      control: "raw-extensions",
      // Kept in the original for lossless round-trip, but NOT surfaced as editable fields:
      //  - canonical/bundled keys handled elsewhere, and
      //  - account/DB/hosting state that is not authored card content (accent belongs to the account,
      //    id/token_count are RC-derived, image/thumbnail urls are RC hosting - the portrait is canonical).
      hide: [
        "tagline", "genre", "fandom", "nsfw", "content_rating", "source_url", "creators_note",
        "creator_notes", "details", "alternate_greeting_titles", "linkedLorebooks",
        "linkedRegexScripts", "type",
        "accent_color", "id", "token_count", "image_url", "thumbnail_url",
      ],
    },
  ],
};

export default rolecall;
