/**
 * Pure persona capabilities + machinery (PERSONA-JEWEL-PLAN.md P0+). The inject compiler lands
 * in P2; folders-as-schema: this barrel is the only import surface for core/persona.
 */
export {
  fieldVisibility,
  parseWriteFor,
  PERSONA_WRITE_FOR_LABELS,
  PERSONA_WRITE_FOR_PROFILES,
} from "./capabilities";
export type { FieldVisibility, PersonaFieldKey, PersonaWriteForProfile } from "./capabilities";
export {
  allPersonaFieldKeys,
  injectionsForProfile,
  PERSONA_ALL_INJECTIONS,
  PERSONA_CORE_KEYS,
  PERSONA_INJECTION_LABELS,
  PERSONA_INJECTIONS_BY_PROFILE,
  platformOwnsField,
} from "./platform-fields";
export { compileSections, escapeXml, injectPersonaXml, toXmlTagName } from "./inject";
export type { InjectOptions } from "./inject";
