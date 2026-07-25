/**
 * Kit's engine seam: in-process, read-side access to the studio through StudioStore.
 * Kit is a thin shell over the same engine the studio UI drives; nothing here reaches a
 * network or a model. The agent loop and every tool touch the studio only through this bridge,
 * so the surface stays small and the trust boundary stays in one place.
 */
import { homedir } from "node:os";
import {
  StudioStore,
  type CompareSaveResult,
  type EntitySummary,
} from "../studio/store";
import { resolveDefaultStudioDir } from "../studio/resolve-dir";
import { STUDIO_ENTITY_KINDS, type StudioEntityKind } from "../studio/path-policy";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";

export type { EntitySummary } from "../studio/store";

/** A canonical entity as the engine parsed it; tools read this, never raw files. */
export type KitEntity = ParsedCanonicalEntity;

export interface DeckCount {
  kind: StudioEntityKind;
  label: string;
  count: number;
}

export interface KitBridge {
  /** Absolute path of the studio this Kit session is bound to. */
  studioDir: string;
  /** One row per deck kind, in canonical order, with its live entity count. */
  deckCounts(): Promise<DeckCount[]>;
  /** Every entity summary, or just one deck kind's. Bad kinds resolve to []. */
  list(kind?: string): Promise<EntitySummary[]>;
  /** One canonical entity, or null if the kind/id is unknown or unreadable. */
  read(kind: string, id: string): Promise<KitEntity | null>;
  /** Save (create, or overwrite when opts.overwrite) a canonical entity; returns its summary. A real
   * write failure throws (the dispatch turns it into a readable tool result). Every write reaches the
   * studio only after the safety gate has allowed it, upstream in gated-dispatch. */
  save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary>;
  /** Overwrite only when the stored entity still has the expected complete canonical revision. */
  compareAndSave?(raw: unknown, expectedRevision: string): Promise<CompareSaveResult>;
  /** Delete one entity; true when a file was actually removed. Tolerant: a bad kind/id resolves false. */
  delete(kind: string, id: string): Promise<boolean>;
}

const DECK_LABELS: Record<StudioEntityKind, string> = {
  character: "Characters",
  lorebook: "Lorebooks",
  persona: "Personas",
  pack: "Packs",
  regex: "Regex",
  preset: "Presets",
};

/** Bind a Kit session to a studio directory (defaults to the machine's studio). */
export function createBridge(
  studioDir: string = resolveDefaultStudioDir(homedir()),
): KitBridge {
  const store = new StudioStore(studioDir);
  return {
    studioDir,
    async deckCounts(): Promise<DeckCount[]> {
      const tallies = new Map<string, number>();
      for (const entity of await store.list()) {
        tallies.set(entity.kind, (tallies.get(entity.kind) ?? 0) + 1);
      }
      return STUDIO_ENTITY_KINDS.map((kind) => ({
        kind,
        label: DECK_LABELS[kind],
        count: tallies.get(kind) ?? 0,
      }));
    },
    async list(kind?: string): Promise<EntitySummary[]> {
      try {
        return await store.list(kind);
      } catch {
        return [];
      }
    },
    async read(kind: string, id: string): Promise<KitEntity | null> {
      try {
        return await store.read(kind, id);
      } catch {
        return null;
      }
    },
    async save(raw: unknown, opts?: { overwrite?: boolean }): Promise<EntitySummary> {
      return store.save(raw, opts);
    },
    async compareAndSave(raw: unknown, expectedRevision: string): Promise<CompareSaveResult> {
      return store.compareAndSave(raw, expectedRevision);
    },
    async delete(kind: string, id: string): Promise<boolean> {
      try {
        return await store.delete(kind, id);
      } catch {
        return false;
      }
    },
  };
}
