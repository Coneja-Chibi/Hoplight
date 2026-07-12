/**
 * Pure persona editor session ops (P4). A persona is ONE document (no item list), so the session
 * is just body + baseline; patches are pure spreads with the nested-slot helpers the cards need.
 */
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

/** Add/remove a trait tag (deduped, order-preserving). */
export const toggleTrait = (body: PersonaBody, trait: string): PersonaBody => {
  const t = trait.trim();
  if (!t) return body;
  const cur = body.traits ?? [];
  return cur.includes(t)
    ? { ...body, traits: cur.filter((x) => x !== t) }
    : { ...body, traits: [...cur, t] };
};

/** Patch one palette swatch by index; index === length appends. */
export const patchSwatch = (
  body: PersonaBody,
  index: number,
  swatch: { label?: string; name?: string; hex: string } | null,
): PersonaBody => {
  const colors = [...(body.presentation?.colors ?? [])];
  if (swatch === null) colors.splice(index, 1);
  else if (index >= colors.length) colors.push(swatch);
  else colors[index] = swatch;
  return { ...body, presentation: { ...(body.presentation ?? {}), colors } };
};
