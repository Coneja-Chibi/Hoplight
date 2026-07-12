/**
 * Pure persona editor session ops (P4). A persona is ONE document (no item list), so the session
 * is just body + baseline; patches are pure spreads with the nested-slot helpers the cards need.
 */
import type { MediaAsset } from "../../../../entities/character/schema";
import type {
  PersonaBody,
  PersonaChatInjection,
  PersonaIdentity,
  PersonaSections,
} from "../../../../entities/persona/schema";

export const personaDirty = (body: PersonaBody, baseline: PersonaBody): boolean =>
  JSON.stringify(body) !== JSON.stringify(baseline);

export const patchBody = (body: PersonaBody, patch: Partial<PersonaBody>): PersonaBody => ({
  ...body,
  ...patch,
});

export const patchIdentity = (body: PersonaBody, patch: Partial<PersonaIdentity>): PersonaBody => ({
  ...body,
  identity: { ...(body.identity ?? {}), ...patch },
});

export const patchSections = (body: PersonaBody, patch: Partial<PersonaSections>): PersonaBody => ({
  ...body,
  sections: { ...(body.sections ?? {}), ...patch },
});

export const patchInjection = (
  body: PersonaBody,
  patch: Partial<PersonaChatInjection>,
): PersonaBody => ({
  ...body,
  chatInjection: { position: "character", ...(body.chatInjection ?? {}), ...patch },
});

/** Set or clear the uploaded portrait; clearing the last media key drops the slot entirely. */
export const setPortrait = (body: PersonaBody, portrait: MediaAsset | null): PersonaBody => {
  if (portrait) return { ...body, media: { ...(body.media ?? {}), portrait } };
  const { portrait: _gone, ...rest } = body.media ?? {};
  return Object.keys(rest).length > 0 ? { ...body, media: rest } : { ...body, media: undefined };
};

/** Add/remove a trait tag (deduped, order-preserving). */
export const toggleTrait = (body: PersonaBody, trait: string): PersonaBody => {
  const t = trait.trim();
  if (!t) return body;
  const cur = body.traits ?? [];
  return cur.includes(t)
    ? { ...body, traits: cur.filter((x) => x !== t) }
    : { ...body, traits: [...cur, t] };
};
