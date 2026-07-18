// ─────────────────────────────────────────────────────────────
// character.js - figure data for docs/reference/entities/character.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig composition`; this is the data behind that
// id. Edit the shape/labels here; edit the words in the .md.
// Grounded in src/entities/character/schema.ts (CharacterBody).
// ─────────────────────────────────────────────────────────────

export default {
  composition: {
    type: "tree",
    fig: "fig 01",
    title: "CharacterBody, grouped",
    caption:
      "CharacterBody unions what every real character format expresses. Eight " +
      "sub-objects are always present; eight further fields are optional (three " +
      "more sub-objects plus five scalars or reference lists). Nested named shapes " +
      "are shown under the field that holds them; plain scalar fields are summarized " +
      "in each group's note. Three optional sub-objects and five standalone fields sit " +
      "beside the eight required groups. Kinds: body, always-present group, optional field, " +
      "leaf field, nested shape.",
    root: {
      label: "CharacterBody",
      kind: "root",
      sum: "The canonical character superset. Eight required sub-objects plus eight optional fields.",
      children: [
        {
          label: "identity",
          kind: "group",
          sum: "Who the character is: name plus authored identity scalars (nickname, tagline, description, characterVersion, fullName, title, age, pronouns, culture).",
        },
        {
          label: "persona",
          kind: "group",
          sum: "How the character behaves, sounds, and looks. Scalars: personality, scenario, appearance. Nests three shapes.",
          children: [
            { label: "voice: Voice", kind: "shape", sum: "TTS selection and config, never the audio bytes." },
            { label: "imagePrompt: ImagePrompt", kind: "shape", sum: "Authored image-gen prompt hints." },
            { label: "structured: union", kind: "shape", sum: "Structured persona encoding (text or attribute-map kinds)." },
          ],
        },
        {
          label: "prompts",
          kind: "group",
          sum: "Instruction-layer text. Scalars: systemPrompt, postHistoryInstructions, prefill, additionalText.",
          children: [
            { label: "depthInjections: DepthInjection[]", kind: "shape", sum: "Text injected at a fixed depth." },
          ],
        },
        {
          label: "greetings",
          kind: "group",
          sum: "The opening messages. Scalar: firstMessage.",
          children: [
            { label: "alternateGreetings: Greeting[]", kind: "shape", sum: "Swipeable alternate openings." },
            { label: "groupOnlyGreetings: Greeting[]", kind: "shape", sum: "CCv3 group-chat-only greetings." },
          ],
        },
        {
          label: "examples",
          kind: "group",
          sum: "Example dialogue. Scalar: exampleMessages.",
        },
        {
          label: "media",
          kind: "group",
          sum: "Images and the composite-avatar recipe. Scalars: visualKind, faceLabel.",
          children: [
            { label: "portrait: MediaAsset", kind: "shape", sum: "The primary portrait." },
            { label: "assets: MediaAsset[]", kind: "shape", sum: "Expression, outfit, and pose packs." },
            { label: "sprite: Sprite", kind: "shape", sum: "Agnai composite-avatar recipe." },
          ],
        },
        {
          label: "attribution",
          kind: "group",
          sum: "Credit and provenance: creator, originalCreator, source, sourceUrl, license, creatorNotes, creatorNotesMultilingual, publicNote, createdAt, updatedAt.",
        },
        {
          label: "discovery",
          kind: "group",
          sum: "How the card is found: tags, genre, fandom, rating, contentWarnings.",
        },
        {
          label: "presentation?",
          kind: "optional",
          sum: "The casting-card visual identity. Scalars: signatureColor, gradientColors, fieldOrder, spoilers, mediaLinks.",
          children: [
            { label: "palette: Swatch[]", kind: "shape", sum: "Named color swatches." },
            { label: "background: Background", kind: "shape", sum: "Curated background, possibly a video." },
          ],
        },
        {
          label: "settings?",
          kind: "optional",
          sum: "Authored inline dials. Scalars: talkativeness, risu toggles, responseSchema.",
        },
        {
          label: "behavior?",
          kind: "optional",
          sum: "Authored on-card behavior, modeled but never executed by the converter. Scalars: virtualScript, backgroundHTML, backgroundCSS, defaultVariables, prebuiltAsset, moduleToggles, privileged.",
          children: [
            { label: "regexScripts: RegexScript[]", kind: "shape", sum: "Card-embedded find/replace twins (see regex.md)." },
            { label: "triggerScripts: TriggerScript[]", kind: "shape", sum: "Trigger state-machine rows." },
          ],
        },
        {
          label: "bias?",
          kind: "field",
          sum: "Character-level phrase/logit bias pairs.",
        },
        {
          label: "worldName?",
          kind: "field",
          sum: "External worldbook link by name (distinct from knowledgeRefs).",
        },
        {
          label: "knowledgeRefs?",
          kind: "field",
          sum: "Ordered ids of linked canonical lorebooks.",
        },
        {
          label: "behaviorRefs?",
          kind: "field",
          sum: "Ordered ids of linked standalone regex/script entities.",
        },
        {
          label: "variants?",
          kind: "field",
          sum: "Alternate versions of this character.",
          children: [
            { label: "CharacterVariant", kind: "shape", sum: "id, label, mirrorBase, overrides (a deep partial of the body)." },
          ],
        },
      ],
    },
  },
};
