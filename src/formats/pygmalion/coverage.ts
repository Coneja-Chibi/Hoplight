/**
 * Pygmalion flat JSON coverage - strict subset of canonical (5 prose fields + optional face via PNG).
 * Grounded in docs/reference/platform-native-fields.md + design/FORMATS-LANDSCAPE.md Family 3.
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "persona.personality",
    "persona.scenario",
    "greetings.firstMessage",
    "examples.exampleMessages",
    // description only if we fold char_persona there on import when personality empty - we map persona
    // primarily; description is filled as a convenience mirror only when personality is set (see notes).
    "identity.description",
    "media.portrait",
  ],
  notes: {
    "persona.personality": "wire char_persona (the one persona blob)",
    "identity.description": "mirrors char_persona on import for shared UI; re-export prefers personality",
    "media.portrait": "PNG carrier pixels when imported from a Pygmalion-style chara PNG; not a card key",
    "metadata": "optional tool provenance rides original only",
  },
};

/** Flat JSON cannot carry pixels; use this declaration when no PNG carrier is emitted. */
export const jsonCoverage: CoverageDecl = {
  ...coverage,
  carries: coverage.carries.filter((path) => path !== "media.portrait"),
};

export default coverage;
