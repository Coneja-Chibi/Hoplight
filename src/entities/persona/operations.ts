/**
 * Pure persona editor operations shared by semantic capabilities and the Workbench.
 */
import type { MediaAsset } from "../character/schema";
import type {
  PersonaBody,
  PersonaChatInjection,
  PersonaIdentity,
  PersonaSections,
} from "./schema";

export const patchPersonaBody = (
  body: PersonaBody,
  patch: Partial<PersonaBody>,
): PersonaBody => ({ ...body, ...structuredClone(patch) });

export const patchPersonaIdentity = (
  body: PersonaBody,
  patch: Partial<PersonaIdentity>,
): PersonaBody => ({
  ...body,
  identity: { ...(body.identity ?? {}), ...structuredClone(patch) },
});

export const patchPersonaSections = (
  body: PersonaBody,
  patch: Partial<PersonaSections>,
): PersonaBody => ({
  ...body,
  sections: { ...(body.sections ?? {}), ...structuredClone(patch) },
});

export const patchPersonaInjection = (
  body: PersonaBody,
  patch: Partial<PersonaChatInjection>,
): PersonaBody => ({
  ...body,
  chatInjection: {
    position: "character",
    ...(body.chatInjection ?? {}),
    ...structuredClone(patch),
  },
});

/** Set or clear the uploaded portrait; clearing the last media key drops the slot entirely. */
export const setPersonaPortrait = (
  body: PersonaBody,
  portrait: MediaAsset | null,
): PersonaBody => {
  if (portrait) {
    return { ...body, media: { ...(body.media ?? {}), portrait: structuredClone(portrait) } };
  }
  const { portrait: _removed, ...rest } = body.media ?? {};
  return Object.keys(rest).length > 0
    ? { ...body, media: rest }
    : { ...body, media: undefined };
};

/** Add or remove one trimmed trait while retaining authored order. */
export const togglePersonaTrait = (body: PersonaBody, trait: string): PersonaBody => {
  const normalized = trait.trim();
  if (!normalized) return body;
  const current = body.traits ?? [];
  return current.includes(normalized)
    ? { ...body, traits: current.filter((item) => item !== normalized) }
    : { ...body, traits: [...current, normalized] };
};
