/**
 * Marinara's native schema. Marinara rides a SillyTavern card's extensions bag, so its fields live at
 * original.sillytavern.raw.data.extensions.marinara. Field shapes from the extensions census
 * (design/EXTENSIONS-CENSUS.md): rpgStats {enabled, attributes[], hp{value,max}, pools[]} + backstory.
 *
 * PATH UNVERIFIED: there is no Marinara sample in samples/ yet, so the exact extension KEY ("marinara")
 * is a best guess. Confirm it against a real Marinara card before trusting the round-trip; the
 * raw-extensions catch-all below surfaces whatever keys actually exist regardless. One-line fix if the
 * key differs. Bespoke stat UI is correct either way (RpgStats component).
 */
import type { NativeSchema } from "../../../components/native-card";

const MAR = "sillytavern.raw.data.extensions.marinara";

const marinara: NativeSchema = {
  key: "marinara",
  label: "Marinara",
  fields: [
    {
      path: `${MAR}.rpgStats`,
      label: "RPG Stats",
      control: "rpg-stats",
      help: "Attributes, health, and resource pools. Fill them with real controls, no coding.",
    },
    {
      path: `${MAR}.backstory`,
      label: "Backstory",
      control: "textarea",
      help: "A longer background Marinara keeps for the character.",
    },
    {
      // catch-all: surfaces every other marinara key that actually exists on the card, path-agnostic
      path: MAR,
      label: "Other Marinara data",
      control: "raw-extensions",
      hide: ["rpgStats", "backstory"],
    },
  ],
};

export default marinara;
