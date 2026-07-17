/**
 * Marinara native schema. Re-audited vs Marinara-Engine (character.ts + CharacterEditor).
 * Fields sit DIRECTLY under CCv2 data.extensions (`sillytavern.raw.data.extensions.*`).
 * Character rpgStats = enabled/attributes/hp only (no pools). Colored bars are Persona
 * personaStats.bars - different entity. avatarCrop + trackerCardColors are on-card.
 */
import type { NativeSchema } from "../../../components/native-card";

/** Marinara writes bare into the CCv2 extensions bag (verified: no .marinara sub-namespace) */
const EXT = "sillytavern.raw.data.extensions";

const marinara: NativeSchema = {
  key: "marinara",
  label: "Marinara",
  fields: [
    {
      path: `${EXT}.rpgStats`,
      label: "RPG Stats",
      control: "rpg-stats",
      help: "Attributes and hit points on the character card (Marinara RPGStatsConfig). Status bars like Satiety/Energy live on Personas, not here.",
    },
    {
      path: `${EXT}.backstory`,
      label: "Backstory",
      control: "textarea",
      help: "A longer background appended to the description.",
    },
    {
      path: `${EXT}.appearance`,
      label: "Appearance",
      control: "textarea",
      help: "Physical description (Marinara suggests wrapping it in XML-style tags).",
    },
    {
      path: `${EXT}.nameColor`,
      label: "Name color",
      control: "color",
      help: "Chat display name color. Hex or CSS gradient.",
    },
    {
      path: `${EXT}.dialogueColor`,
      label: "Dialogue color",
      control: "color",
      help: "Quoted dialogue highlight. Hex or CSS gradient.",
    },
    {
      path: `${EXT}.boxColor`,
      label: "Message box color",
      control: "color",
      help: "Message bubble background. Hex or CSS color.",
    },
    {
      path: `${EXT}.avatarCrop`,
      label: "Avatar crop",
      control: "avatar-crop",
      help: "Drag a square over the face portrait. Stored as Marinara normalized source rect. Legacy zoom/offset crops stay until cleared.",
    },
    {
      path: `${EXT}.trackerCardColors`,
      label: "Tracker card colors",
      control: "tracker-card-colors",
      help: "Tracker panel paint: mode, display/accent/surface, portrait stage.",
    },
    {
      path: `${EXT}.conversationStatus`,
      label: "Presence",
      control: "read-only",
      help: "Runtime presence (Conversation mode). Prefer chat-scoped status in newer Marinara; shown if present on the card.",
    },
  ],
};

export default marinara;
