/**
 * Persona editor session state. Canonical mutations delegate to the entity-layer authority.
 */
import type { PersonaBody } from "../../../../entities/persona/schema";

export const personaDirty = (body: PersonaBody, baseline: PersonaBody): boolean =>
  JSON.stringify(body) !== JSON.stringify(baseline);

export {
  patchPersonaBody as patchBody,
  patchPersonaIdentity as patchIdentity,
  patchPersonaInjection as patchInjection,
  patchPersonaSections as patchSections,
  setPersonaPortrait as setPortrait,
  togglePersonaTrait as toggleTrait,
} from "../../../../entities/persona/operations";
