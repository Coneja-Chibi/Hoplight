// ─────────────────────────────────────────────────────────────
// persona.js - figure data for docs/reference/entities/persona.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig composition`; this is the data behind that
// id. Edit the shape/labels here; edit the words in the .md.
// Grounded in src/entities/persona/schema.ts (PersonaBody).
// ─────────────────────────────────────────────────────────────

export default {
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "PersonaBody, grouped",
    caption:
      "PersonaBody is flatter than CharacterBody: two fields are required, name and content, " +
      "and eleven further fields are optional. Six of the optional fields nest a named shape " +
      "(sections, identity, presentation, chatInjection, attribution, media); the rest are " +
      "scalars or reference lists. Kinds: body, optional field with a nested shape, plain " +
      "field, nested shape.",
    root: {
      label: "PersonaBody",
      kind: "root",
      sum: "The canonical persona superset: the USER's identity, first person, counterpart to CharacterBody.",
      children: [
        { label: "name", kind: "field", sum: "The persona's canonical name." },
        { label: "brief?", kind: "field", sum: "Short library-card summary. Never the injected text." },
        { label: "content", kind: "field", sum: "The full first-person text injected as {{user}}'s voice." },
        {
          label: "sections?",
          kind: "optional",
          sum: "Structured alternative source for content: appearance, body, personality, quirks, history.",
          children: [
            {
              label: "PersonaSections",
              kind: "shape",
              sum: "Five optional section fields, compiled into content in fixed order when content is empty.",
            },
          ],
        },
        { label: "sectionOrder?", kind: "field", sum: "Creator-chosen display order of sections." },
        { label: "traits?", kind: "field", sum: "Personality-descriptor traits (RC details.traits / card tags)." },
        {
          label: "identity?",
          kind: "optional",
          sum: "Authored identity attributes: tagline, age, height, pronouns.",
          children: [
            {
              label: "PersonaIdentity",
              kind: "shape",
              sum: "tagline, age (free text), height, pronouns, and the structured pronoun triplet.",
            },
            {
              label: "PersonaPronounSet",
              kind: "shape",
              sum: "subjective/objective/possessive: real data an engine can conjugate with (Lumiverse).",
            },
          ],
        },
        {
          label: "presentation?",
          kind: "optional",
          sum: "The persona's visual identity (RC theming).",
          children: [
            {
              label: "PersonaPresentation",
              kind: "shape",
              sum: "signatureColor, colors (Swatch[]), imageUrl.",
            },
          ],
        },
        { label: "knowledgeRefs?", kind: "field", sum: "Ordered ids of linked canonical lorebooks." },
        { label: "rating?", kind: "field", sum: "Explicit content rating, reusing the canonical ContentRating." },
        {
          label: "chatInjection?",
          kind: "optional",
          sum: "Where and how the content is injected into the prompt.",
          children: [
            {
              label: "PersonaChatInjection",
              kind: "shape",
              sum: "position (RC's four stops or ST's five), depth, role, wrapper.",
            },
          ],
        },
        {
          label: "attribution?",
          kind: "optional",
          sum: "Credit and provenance.",
          children: [
            { label: "PersonaAttribution", kind: "shape", sum: "creator, version, createdAt, source." },
          ],
        },
        {
          label: "media?",
          kind: "optional",
          sum: "Studio-side portrait slot.",
          children: [
            {
              label: "MediaAsset",
              kind: "shape",
              sum: "Same shape as CharacterBody.media.portrait; see character.md.",
            },
          ],
        },
      ],
    },
  },
};
