/**
 * Marinara's native schema. VERIFIED against Marinara-Engine's own source types
 * (packages/shared/src/types/character.ts): Marinara does NOT namespace - it writes its fields DIRECTLY
 * under a standard CCv2 card's data.extensions, so they ride the imported SillyTavern original at
 * `sillytavern.raw.data.extensions.*`. Its card editor has a dedicated RPG Stats tab, long-text
 * backstory/appearance, and color pickers for the character's name/dialogue/box colors. See
 * docs/reference/platform-native-fields.md.
 *
 * NOT here: talkativeness/depth_prompt/fav/world are canonical or ST-owned (would double-render);
 * personaStats is a Persona entity; gamePrompt/quests/dynamicState are runtime game state, not the card.
 * No own catch-all: the ST native schema's catch-all already covers leftover keys in this shared bag.
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
      help: "Attributes, health, and resource pools. Fill them with real controls, no coding.",
    },
    { path: `${EXT}.backstory`, label: "Backstory", control: "textarea", help: "A longer background appended to the description." },
    { path: `${EXT}.appearance`, label: "Appearance", control: "textarea", help: "Physical description (Marinara suggests wrapping it in XML-style tags)." },
    { path: `${EXT}.nameColor`, label: "Name color", control: "color", help: "Color of the character's displayed name in chat." },
    { path: `${EXT}.dialogueColor`, label: "Dialogue color", control: "color", help: "Color of quoted dialogue text." },
    { path: `${EXT}.boxColor`, label: "Message box color", control: "color", help: "Background color of this character's message bubble." },
    {
      path: `${EXT}.conversationStatus`,
      label: "Presence",
      control: "read-only",
      help: "Discord-style presence Marinara shows in Conversation mode (runtime state).",
    },
  ],
};

export default marinara;
