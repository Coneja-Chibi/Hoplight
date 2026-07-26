/**
 * Structural store contracts - what the server handler actually needs from storage. The handler
 * types on these (never the concrete classes) so any backend that satisfies them can host the
 * studio: fs-backed on desktop/CLI, OPFS-backed in the pocket build. The classes satisfy these
 * structurally; no implements clause, no import cycle.
 */
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import type { CompareSaveResult, EntitySummary, StudioInventory } from "./store";
import type { StudioSettings } from "./settings-shape";

export interface StudioStoreLike {
  studioPath(): string;
  inventory(kind?: string): Promise<StudioInventory>;
  list(kind?: string): Promise<EntitySummary[]>;
  read(kind: string, id: string): Promise<ParsedCanonicalEntity | null>;
  delete(kind: string, id: string): Promise<boolean>;
  save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary>;
  compareAndSave(raw: unknown, expectedRevision: string): Promise<CompareSaveResult>;
}

export interface SettingsStoreLike {
  read(): Promise<StudioSettings>;
  save(raw: unknown): Promise<StudioSettings>;
  update(raw: unknown): Promise<StudioSettings>;
}
