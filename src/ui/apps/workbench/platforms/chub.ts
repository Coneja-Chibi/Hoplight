/**
 * Chub (Chub.ai / CharacterHub / Venus) native schema. VERIFIED against the live Chub API
 * (definition.extensions.chub), which is what Chub writes into an exported CCv2 card's
 * data.extensions.chub - so it rides the imported SillyTavern original at
 * `sillytavern.raw.data.extensions.chub.*`. See docs/reference/platform-native-fields.md.
 *
 * Chub's own editor: background is an owner-only image, related_lorebooks is a reference selector,
 * expression packs are sprite sets, custom_css is a raw CSS box (Chub injects it into the page - so we
 * FLAG it read-only and never apply it), and id/full_path/preset/Stage-extensions are server-owned refs.
 */
import type { NativeSchema } from "../../../components/native-card";

const CHUB = "sillytavern.raw.data.extensions.chub";

const chub: NativeSchema = {
  key: "chub",
  label: "Chub",
  fields: [
    { path: `${CHUB}.background_image`, label: "Chat background", control: "url", help: "Image shown behind the chat (a Chub CDN URL or your own)." },
    { path: `${CHUB}.expressions`, label: "Expression pack", control: "asset-manager", help: "Named emotion sprites. Populated shape varies by card; drop images to fill." },
    { path: `${CHUB}.alt_expressions`, label: "Alternate expressions", control: "asset-manager", help: "Secondary expression sprite sets." },
    {
      path: `${CHUB}.related_lorebooks`,
      label: "Related lorebooks",
      control: "read-only",
      help: "Lorebooks Chub attaches by reference (edited in the Lorebook library, not on the card).",
    },
    {
      path: `${CHUB}.custom_css`,
      label: "Custom CSS",
      control: "read-only",
      help: "Chub page styling. Kept exactly as saved and NEVER applied (executable/styling payload).",
    },
    { path: `${CHUB}.preset`, label: "Bound preset", control: "read-only", help: "A generation preset the creator attached (a reference, not editable here)." },
    { path: `${CHUB}.extensions`, label: "Chub Stages", control: "read-only", help: "References to Chub Stages (code projects). Shown, never run." },
    { path: `${CHUB}.full_path`, label: "Chub path", control: "read-only", help: "creator/slug identity on Chub." },
    { path: `${CHUB}.id`, label: "Chub id", control: "read-only" },
    {
      path: CHUB,
      label: "Other Chub data",
      control: "raw-extensions",
      hide: ["background_image", "expressions", "alt_expressions", "related_lorebooks", "custom_css", "preset", "extensions", "full_path", "id"],
    },
  ],
};

export default chub;
