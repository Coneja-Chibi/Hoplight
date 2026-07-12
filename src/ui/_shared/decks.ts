/**
 * Deck metadata - the authored per-kind design constants (accent, plural label, short tag),
 * extracted exactly once. Consumers: the Workbench deck chips + floated deck, the shell's tab
 * kind tags and tray beads, the Library rail (when its room builds). Kinds are OPEN strings
 * (drop-in formats may add kinds); deckMeta falls back gracefully for unknown ones.
 */

export interface DeckMeta {
  /** canonical kind ("character") */
  kind: string;
  /** the deck's plural display name ("Characters") */
  plural: string;
  /** short tag for tabs/chips ("char") */
  short: string;
  /** the deck's accent (locked vs-shell-apps chip colors) */
  accent: string;
}

const DECKS: DeckMeta[] = [
  { kind: "character", plural: "Characters", short: "char", accent: "#e6a52a" },
  { kind: "lorebook", plural: "Lorebooks", short: "lore", accent: "#b968f7" },
  { kind: "persona", plural: "Personas", short: "pers", accent: "#2ba79a" },
  { kind: "pack", plural: "Sprite packs", short: "pack", accent: "#e11d48" },
  { kind: "preset", plural: "Presets", short: "set", accent: "#10b981" },
  { kind: "regex", plural: "Regex sets", short: "rgx", accent: "#58c4a6" },
];

const BY_KIND = new Map(DECKS.map((d) => [d.kind, d]));

/** Known decks in display order. */
export const knownDecks = (): DeckMeta[] => [...DECKS];

/** Meta for any kind; unknown kinds get a readable fallback (open-by-design). */
export function deckMeta(kind: string): DeckMeta {
  return (
    BY_KIND.get(kind) ?? {
      kind,
      plural: kind.charAt(0).toUpperCase() + kind.slice(1) + "s",
      short: kind.slice(0, 4),
      accent: "#8a8496",
    }
  );
}
