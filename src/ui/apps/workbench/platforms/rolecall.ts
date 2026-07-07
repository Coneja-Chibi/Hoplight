/**
 * RoleCall's native schema. Most of RoleCall is canonical (Vaude was seeded from it); these are the
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
    { path: `${RC_EXT}.image_url`, label: "Image URL", control: "url" },
    { path: `${RC_EXT}.thumbnail_url`, label: "Thumbnail URL", control: "url" },
    { path: `${RC_EXT}.accent_color`, label: "Accent color (account-level)", control: "read-only", help: "Belongs to the account, not the card." },
    { path: `${RC_EXT}.id`, label: "RoleCall id", control: "read-only" },
    { path: `${RC_EXT}.token_count`, label: "Token count (derived)", control: "read-only" },
    {
      path: RC_EXT,
      label: "Other RoleCall data",
      control: "raw-extensions",
      // canonical + bundled-content keys already handled elsewhere; keep them out of the catch-all
      hide: [
        "tagline", "genre", "fandom", "nsfw", "content_rating", "source_url", "creators_note",
        "creator_notes", "details", "alternate_greeting_titles", "linkedLorebooks",
        "linkedRegexScripts", "type",
      ],
    },
  ],
};

export default rolecall;
