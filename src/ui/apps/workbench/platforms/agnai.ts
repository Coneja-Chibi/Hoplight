/**
 * Agnai native schema. Paths into entity.original (agnai.raw is the full native card).
 *
 * Same rule as RoleCall + SillyTavern:
 *   - Shared character fields (voice, image prompt, structured persona, sprite, response schema, …)
 *     live on the body via FIELD_MODULES + coverage. Do NOT declare them here.
 *   - This file is only platform leftovers: things that stay on the sealed original card.
 *
 * Leftovers: embedded memory book + raw keys not already edited as shared fields.
 */
import type { NativeSchema } from "../../../components/native-card";

const RAW = "agnai.raw";

const agnai: NativeSchema = {
  key: "agnai",
  label: "Agnai",
  fields: [
    {
      path: `${RAW}.characterBook`,
      label: "Memory book",
      control: "lorebook-link",
      help: "Embedded Agnai memory book (kind memory). Opens the lore surface when ready.",
    },
    {
      path: RAW,
      label: "Other Agnai data",
      control: "raw-extensions",
      hide: [
        // shared body fields (FIELD_MODULES + format adapter) - not re-edited here
        "persona",
        "voice",
        "voiceDisabled",
        "imageSettings",
        "sprite",
        "visualType",
        "json",
        // surfaced above
        "characterBook",
        // shared prose / identity already on FIELD_MODULES
        "kind",
        "name",
        "description",
        "appearance",
        "greeting",
        "scenario",
        "sampleChat",
        "alternateGreetings",
        "systemPrompt",
        "postHistoryInstructions",
        "insert",
        "prefill",
        "creator",
        "characterVersion",
        "tags",
        "culture",
        // body-mapped face (media.portrait); not re-edited in raw
        "avatar",
        // account / derived
        "_id",
        "userId",
        "createdAt",
        "updatedAt",
        "deletedAt",
        "favorite",
        "folder",
        "imageProviderId",
      ],
    },
  ],
};

export default agnai;
