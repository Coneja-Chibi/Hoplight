// ─────────────────────────────────────────────────────────────
// personas.js - figure data for docs/guide/personas.md, keyed by
// figure id. Prose lives in the .md and drops a figure in with a
// line like `@fig compile`; this is the data behind that id. Edit
// the shape/labels here; edit the words in the .md. Same DATA SHAPE
// as portfolio/site/data/figures.js; imports nothing. Renderer comes
// later, the `@fig` marker is inert until then.
// Grounded in src/core/persona/inject.ts (injectPersonaXml).
// ─────────────────────────────────────────────────────────────

export default {
  compile: {
    type: "flow",
    fig: "fig·01",
    title: "what actually reaches the model",
    caption:
      "Brief never joins this pipeline, it is the shelf blurb only. Identity always leads, then " +
      "sections in whatever order you've set (Identity Text only wakes up once every section is " +
      "empty), compiled into one block and injected at the stop you pick.",
    steps: [
      { label: "Identity", sub: "pronouns · tagline · height · age, always first", color: "sage" },
      { label: "Sections, if filled", sub: "Appearance · Personality · Quirks · History", color: "teal" },
      { label: "Identity Text, if not", sub: "the flat fallback, only when every section is empty", color: "ochre" },
      { label: "Compiled into one block", sub: "the Live Preview shows this exact output", color: "clay" },
      { label: "Injected at your stop", sub: "the position you pick in Prompt Injection", color: "plum" },
    ],
  },
};
