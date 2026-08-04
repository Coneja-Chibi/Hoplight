/** Shared format-adapter contracts that connect drop-in codecs to the canonical model. */
import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { CanonicalPersona } from "../entities/persona/schema";
import type { CanonicalPreset } from "../entities/preset/schema";
import type { CanonicalRegexSet } from "../entities/regex/schema";
import type { CoverageDecl } from "./coverage";
import type { FormatId } from "./canonical";
import type { SerializeReport } from "./reports";

/** Raw input handed to an adapter. Binary formats use bytes; text/json use text. */
export interface AdapterInput {
  bytes?: Uint8Array;
  text?: string;
  filename?: string;
}

/** What an adapter emits when writing a canonical entity out to its format. */
export interface AdapterOutput {
  bytes?: Uint8Array;
  text?: string;
  suggestedExtension: string;
  /** Named field-loss accounting attached by the conversion/export boundary. */
  report?: SerializeReport;
}

/**
 * Cross-entity context handed to fromCanonical at bundle-export time. Resolved by the layer that
 * owns the registry (it holds every entity), never by the core. A character adapter for a format
 * that embeds knowledge (CCv2/v3 character_book) re-embeds `lorebooks`; adapters that do not simply
 * ignore it. Optional, so a `(entity) => out` adapter stays assignable.
 */
export interface EmitContext {
  lorebooks?: CanonicalLorebook[];
  /**
   * Caller-requested output extension (no leading dot), e.g. "json" or "charx".
   * Multi-container adapters honor this when set; omit to keep source-container defaults.
   */
  requestedExtension?: string;
}

/** Fields every adapter carries, whatever entity kind it reads and writes. */
interface AdapterBase {
  id: FormatId;
  label: string;
  /** File extensions this adapter writes (no dot), so the CLI can pick a target by output name. */
  outputExtensions: string[];
  /** 0..1 confidence that this adapter can read the given input. */
  detect(input: AdapterInput): number;
  /** True on Hoplight's own storage format(s): still import/exportable, but never offered as an
   * external "publish to" platform (the truth lives here, with the format, not in any UI list). */
  native?: boolean;
  /** True on the GENERIC reader of a family (the plain Tavern/CC card): cards it claims carry no
   * platform-specific fields, so the UI's card-type chip says "Default" instead of a platform. */
  generic?: boolean;
  /** Which canonical body paths this format's wire carries (the editor lens's ground truth; the
   * format folder owns the claim - src/formats/<id>/coverage.ts). Absent = lens shows the platform
   * tab marked "coverage not declared" and dims nothing (deny-by-absence stays honest). */
  coverage?: CoverageDecl;
  /**
   * When false, coverage still powers export honesty but the editor platform strip omits this
   * format (export-only / legacy wire, not a separate host product). Default true when coverage set.
   */
  lens?: boolean;
}

/** An adapter that reads and writes character cards. */
export interface CharacterAdapter extends AdapterBase {
  kind: "character";
  /** Read a file into the canonical model, stashing originals + unmapped fields in original. */
  toCanonical(input: AdapterInput): CanonicalCharacter;
  /** Write a canonical character out to this format, re-emitting its own original for round-trip. */
  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput;
  /**
   * Optional: pull an embedded lorebook whose dialect is NOT a CCv2/v3 `character_book` (which the
   * shared extractor handles), e.g. Agnai's native `characterBook` MemoryBook. The bundle layer calls
   * this instead of the default CCv3 extraction when present. A tolerant reader: return null when the
   * card carries no embedded book. Keeps each format's dialect in its own folder (layers point inward).
   */
  extractLorebook?(entity: CanonicalCharacter): CanonicalLorebook | null;
}

/** An adapter that reads and writes standalone lorebooks (world info). */
export interface LorebookAdapter extends AdapterBase {
  kind: "lorebook";
  toCanonical(input: AdapterInput): CanonicalLorebook;
  fromCanonical(entity: CanonicalLorebook): AdapterOutput;
}

/** An adapter that reads and writes user personas ({{user}}-identity files). */
export interface PersonaAdapter extends AdapterBase {
  kind: "persona";
  toCanonical(input: AdapterInput): CanonicalPersona;
  fromCanonical(entity: CanonicalPersona): AdapterOutput;
}

/** An adapter that reads and writes standalone regex-script sets (find/replace rulebooks). */
export interface RegexAdapter extends AdapterBase {
  kind: "regex";
  toCanonical(input: AdapterInput): CanonicalRegexSet;
  fromCanonical(entity: CanonicalRegexSet): AdapterOutput;
}

/** An adapter that reads and writes standalone chat presets (prompt/sampler configurations). */
export interface PresetAdapter extends AdapterBase {
  kind: "preset";
  toCanonical(input: AdapterInput): CanonicalPreset;
  fromCanonical(entity: CanonicalPreset): AdapterOutput;
  /**
   * Optional: pull regex scripts BUNDLED inside the preset export (ST/RC ride them under
   * `extensions.regex_scripts`). The bundle layer surfaces the set as a related entity beside the
   * preset, the same seam as CharacterAdapter.extractLorebook. Tolerant: null when none ride.
   */
  extractRegex?(entity: CanonicalPreset): CanonicalRegexSet | null;
  /**
   * Optional: the INVERSE of extractRegex - write regex sets back down into the preset's own bundle
   * field on emit, so a standalone set can be attached to a preset the same way a lorebook is
   * re-embedded into a character by EmitContext.
   *
   * ADDITIVE BY CONTRACT. An empty array (or no call at all) must leave the emitted bytes exactly as
   * `fromCanonical` produced them, because preset bundling was measured as additive and a preset
   * carrying no regexes must not start differing from its bare form. `emit-bundle.test.ts` holds that
   * property; do not relax it into "usually the same".
   */
  embedRegex?(entity: CanonicalPreset, sets: readonly CanonicalRegexSet[]): AdapterOutput;
}

/**
 * The contract every format plugin implements, discriminated by `kind`. Adding a format = adding one
 * of these; adding an entity KIND = adding a member here plus a sibling entities/<kind>/ folder. Core
 * NEVER imports adapters directly; a registry wires them to the CLI and app. The registry stores this
 * union heterogeneously; a converter narrows on `kind` (guard src.kind === target.kind) before it
 * hands an entity to fromCanonical, so no unsafe cross-kind call is representable.
 */
export type FormatAdapter =
  | CharacterAdapter
  | LorebookAdapter
  | PersonaAdapter
  | RegexAdapter
  | PresetAdapter;
