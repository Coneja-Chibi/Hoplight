import type { CanonicalEntity } from "../../core/canonical";
import type { ContentRating, Swatch } from "../character/schema";

/**
 * CanonicalPersona - the USER-identity entity: the counterpart to a character (same prompt-injection
 * machinery, opposite voice - this is {{user}}, first person). Built from specs/formats/personas.md,
 * whose field maps are pinned by RoleCall's own persona-roundtrip tests. Four real source shapes feed
 * it: RC native `rcpersona`, RC's production V2-card-with-side-channel export, foreign V2/V3 cards
 * imported AS personas, and legacy RoleOut PNGs.
 *
 * The load-bearing distinction of the whole family: `brief` (short library-card summary, NEVER
 * injected) vs `content` (the full first-person text injected as {{user}}). Every source has some
 * short/long split (RC description/content; card creator_notes/description; RoleOut title/content) and
 * swapping them is the exact production bug RC's round-trip suite was written to pin.
 *
 * This folder IS the persona entity (folders-as-schema): drop a sibling in src/entities/ for a new
 * content type the same way.
 */

/** Structured alternative source for `content`; compile order is fixed (see sectionOrder default). */
export interface PersonaSections {
  appearance?: string;
  body?: string;
  personality?: string;
  quirks?: string;
  history?: string;
}

/**
 * Lumiverse's structured pronoun triplet (subjective/objective/possessive) - real DATA the
 * engine can conjugate with, unlike the free-text `pronouns` display string (which stays, for
 * RC/ST round-trip). Additive (P0, PERSONA-JEWEL-PLAN.md); absent everywhere else.
 */
export interface PersonaPronounSet {
  subjective: string;
  objective: string;
  possessive: string;
}

/** Authored identity attributes (RC casting-card details). */
export interface PersonaIdentity {
  tagline?: string;
  /** free TEXT ("23", "ageless"), never an int */
  age?: string;
  height?: string;
  pronouns?: string;
  pronounSet?: PersonaPronounSet;
}

/** The persona's visual identity (RC theming). */
export interface PersonaPresentation {
  signatureColor?: string;
  colors?: Swatch[];
  /** external image URL (JSON export) - PNG exports carry the image as the file body instead */
  imageUrl?: string;
}

/**
 * Prompt-positioning fields. Two real dialects share this slot (P0, PERSONA-JEWEL-PLAN.md):
 * SillyTavern's five stops (prompt / author-note top+bottom / in-chat at depth+role / none) and
 * RoleCall's four (world / character / scene / depth, PersonaPanel.tsx InjectionPosition), plus
 * RC's optional wrapper text (`injection_prefix`). OPEN union: which stops a Write-for lens can
 * carry lives in core/persona/platform-fields.ts (`injectionsForProfile`), never a UI literal.
 */
export interface PersonaChatInjection {
  position:
    | "prompt"
    | "author_note_top"
    | "author_note_bottom"
    | "in_chat"
    | "none"
    | "world"
    | "character"
    | "scene"
    | "depth"
    | (string & {});
  depth?: number;
  role?: "system" | "user" | "assistant";
  /** RC's custom wrapper text prepended to the injected block (injection_prefix). */
  wrapper?: string;
}

export interface PersonaAttribution {
  creator?: string;
  version?: string;
  /** ISO 8601 (the rcpersona wire carries strings, not unix seconds) */
  createdAt?: string;
  /** origin platform tag ("rolecall", "sillytavern", "custom", ...) */
  source?: string;
}

/** Fixed compile order for sections -> content (docs/PERSONA_FORMAT.md) and the sectionOrder default. */
export const SECTION_ORDER_DEFAULT = ["appearance", "body", "personality", "quirks", "history"] as const;

export interface PersonaBody {
  name: string;
  /** short user-facing summary (library card blurb) - NEVER the injected text */
  brief?: string;
  /** the full first-person text injected as {{user}}'s voice */
  content: string;
  /**
   * structured alternative source for `content`. Canonical keeps BOTH (unlike the source formats'
   * "content wins, sections ignored" read rule) so the editor can offer structured editing even when
   * the source was flat; compiling sections into content happens in codecs at serialize time.
   */
  sections?: PersonaSections;
  /** creator-chosen display order of sections */
  sectionOrder?: string[];
  /** personality-descriptor traits (RC details.traits / card tags) */
  traits?: string[];
  identity?: PersonaIdentity;
  presentation?: PersonaPresentation;
  /** linked canonical lorebook id(s), ordered - same reference-not-inline rule as CharacterBody */
  knowledgeRefs?: string[];
  /** reuses the canonical graded rating (RC all_hours -> "all-ages", after_dark -> "explicit") */
  rating?: ContentRating;
  chatInjection?: PersonaChatInjection;
  attribution?: PersonaAttribution;
}

export type CanonicalPersona = CanonicalEntity<"persona", PersonaBody>;

/** A blank persona body (the New persona seed). */
export function emptyPersonaBody(name: string): PersonaBody {
  return { name, content: "" };
}
