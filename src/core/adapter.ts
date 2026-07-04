import type { CanonicalCharacter } from "../entities/character/schema";
import type { CanonicalLorebook } from "../entities/lorebook/schema";
import type { FormatId } from "./canonical";

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
}

/**
 * Cross-entity context handed to fromCanonical at bundle-export time. Resolved by the layer that
 * owns the registry (it holds every entity), never by the core. A character adapter for a format
 * that embeds knowledge (CCv2/v3 character_book) re-embeds `lorebooks`; adapters that do not simply
 * ignore it. Optional, so a `(entity) => out` adapter stays assignable.
 */
export interface EmitContext {
  lorebooks?: CanonicalLorebook[];
}

/** Fields every adapter carries, whatever entity kind it reads and writes. */
interface AdapterBase {
  id: FormatId;
  label: string;
  /** File extensions this adapter writes (no dot), so the CLI can pick a target by output name. */
  outputExtensions: string[];
  /** 0..1 confidence that this adapter can read the given input. */
  detect(input: AdapterInput): number;
}

/** An adapter that reads and writes character cards. */
export interface CharacterAdapter extends AdapterBase {
  kind: "character";
  /** Read a file into the canonical model, stashing originals + unmapped fields in escrow. */
  toCanonical(input: AdapterInput): CanonicalCharacter;
  /** Write a canonical character out to this format, re-emitting its own escrow for round-trip. */
  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput;
}

/** An adapter that reads and writes standalone lorebooks (world info). */
export interface LorebookAdapter extends AdapterBase {
  kind: "lorebook";
  toCanonical(input: AdapterInput): CanonicalLorebook;
  fromCanonical(entity: CanonicalLorebook): AdapterOutput;
}

/**
 * The contract every format plugin implements, discriminated by `kind`. Adding a format = adding one
 * of these; adding an entity KIND = adding a member here plus a sibling entities/<kind>/ folder. Core
 * NEVER imports adapters directly; a registry wires them to the CLI and app. The registry stores this
 * union heterogeneously; a converter narrows on `kind` (guard src.kind === target.kind) before it
 * hands an entity to fromCanonical, so no unsafe cross-kind call is representable.
 */
export type FormatAdapter = CharacterAdapter | LorebookAdapter;
