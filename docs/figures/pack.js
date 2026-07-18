// ─────────────────────────────────────────────────────────────
// pack.js - figure data for docs/reference/entities/pack.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig composition`; this is the data behind that
// id. Edit the shape/labels here; edit the words in the .md.
// Grounded in src/entities/pack/schema.ts (PackBody) and
// src/core/media/pack.ts (SpritePackValue, SpritePackItem), the
// hub shape PackBody shares with CharacterBody.media.
// ─────────────────────────────────────────────────────────────

export default {
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "PackBody, grouped",
    caption:
      "PackBody stays flat: a name, an optional shelf brief, the pack itself, and an " +
      "optional multi-character groups map. pack and each entry of groups are a " +
      "SpritePackValue, the same label-to-image hub shape a character's media.assets " +
      "(role emotion) project through. SpritePackValue and SpritePackItem live in " +
      "core/media/pack.ts, not in this entity's schema file, so they are described in " +
      "prose on the page rather than generated into a field table. Kinds: root, " +
      "required group, optional field, nested shape.",
    root: {
      label: "PackBody",
      kind: "root",
      sum: "The canonical pack body. One small flat record, no always-present sub-objects.",
      children: [
        {
          label: "name",
          kind: "field",
          sum: "Library / tab name.",
        },
        {
          label: "brief?",
          kind: "optional",
          sum: "Short blurb on the shelf card. Never reaches a host wire: pack has no adapter.",
        },
        {
          label: "pack",
          kind: "group",
          sum: "The emotion pack: label to image. The hub shape shared with character media.",
          children: [
            {
              label: "items: SpritePackItem[]",
              kind: "shape",
              sum: "id, label, ref, mime?. One face per item.",
            },
            {
              label: "enabled?: boolean",
              kind: "field",
              sum: "Creator on/off toggle for the pack as a whole.",
            },
            {
              label: "defaultLabel?: string",
              kind: "field",
              sum: "Which face is the resting/default face.",
            },
          ],
        },
        {
          label: "groups?",
          kind: "optional",
          sum: "Multi-character groups (Lumi-style): member name to SpritePackValue. Flat pack is the default group.",
          children: [
            {
              label: "Record<string, SpritePackValue>",
              kind: "shape",
              sum: "One full pack per group member, keyed by that member's name.",
            },
          ],
        },
      ],
    },
  },
};
