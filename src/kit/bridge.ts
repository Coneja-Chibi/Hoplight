/**
 * Kit's engine seam: in-process, read-side access to the studio through StudioStore.
 * Kit is a thin shell over the same engine the studio UI drives; nothing here reaches a
 * network or a model. The agent loop and every tool touch the studio only through this bridge,
 * so the surface stays small and the trust boundary stays in one place.
 */
import { homedir } from "node:os";
import { StudioStore } from "../studio/store";
import { resolveDefaultStudioDir } from "../studio/resolve-dir";
import { STUDIO_ENTITY_KINDS, type StudioEntityKind } from "../studio/path-policy";

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
  };
}
