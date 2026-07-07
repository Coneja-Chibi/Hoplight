/**
 * Character-variant merge - copied faithfully from RoleCall's mechanic
 * (apps/rc src/lib/scene/variant-merge.ts). A variant is an alternate version of the character that
 * OVERRIDES a subset of authored fields; the editor/preview renders the base with the active variant
 * merged in. Pure: returns a NEW body, never mutates the base.
 *
 * Two modes, exactly as RC:
 *   - mirror (default): overlay only the variant's NON-EMPTY fields onto the base; unset fields inherit.
 *   - full override: the variant REPLACES the base; the base name falls through only when the variant
 *     left it unset (RC also falls the image through - deferred here to the media milestone).
 */
import type { CharacterBody, CharacterVariant } from "./schema";

const set = (v: string | undefined): v is string => typeof v === "string" && v.length > 0;
const list = (v: unknown[] | undefined): boolean => Array.isArray(v) && v.length > 0;

/** The base body with `variant` merged in, per the variant's mode. Pure. */
export function applyVariant(base: CharacterBody, variant: CharacterVariant): CharacterBody {
  const pres = base.presentation ?? {};

  if (variant.mirrorBase === false) {
    // full override: variant replaces the base; name falls through when the variant left it unset
    return {
      ...base,
      identity: {
        ...base.identity,
        name: set(variant.name) ? variant.name : base.identity.name,
        tagline: variant.tagline ?? "",
        description: variant.description ?? "",
      },
      persona: {
        ...base.persona,
        personality: variant.personality ?? base.persona.personality,
        scenario: variant.scenario ?? base.persona.scenario,
      },
      greetings: {
        ...base.greetings,
        firstMessage: variant.firstMessage ?? "",
        alternateGreetings: variant.alternateGreetings ?? [],
      },
      examples: { ...base.examples, exampleMessages: variant.exampleMessages ?? "" },
      prompts: { ...base.prompts, systemPrompt: variant.systemPrompt ?? "" },
      presentation: { ...pres, signatureColor: variant.signatureColor ?? pres.signatureColor },
    };
  }

  // mirror (default): overlay only the non-empty variant fields, unset fields inherit from base
  return {
    ...base,
    identity: {
      ...base.identity,
      ...(set(variant.name) && { name: variant.name }),
      ...(set(variant.tagline) && { tagline: variant.tagline }),
      ...(set(variant.description) && { description: variant.description }),
    },
    persona: {
      ...base.persona,
      ...(set(variant.personality) && { personality: variant.personality }),
      ...(set(variant.scenario) && { scenario: variant.scenario }),
    },
    greetings: {
      ...base.greetings,
      ...(set(variant.firstMessage) && { firstMessage: variant.firstMessage }),
      ...(list(variant.alternateGreetings) && { alternateGreetings: variant.alternateGreetings }),
    },
    examples: { ...base.examples, ...(set(variant.exampleMessages) && { exampleMessages: variant.exampleMessages }) },
    prompts: { ...base.prompts, ...(set(variant.systemPrompt) && { systemPrompt: variant.systemPrompt }) },
    presentation: { ...pres, ...(set(variant.signatureColor) && { signatureColor: variant.signatureColor }) },
  };
}
