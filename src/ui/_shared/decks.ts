/**
 * Deck metadata - the authored per-kind design constants (accent, plural label, short tag),
 * extracted exactly once. Consumers: the Workbench deck chips + floated deck, the shell's tab
 * kind tags and tray beads, the Library rail (when its room builds). Kinds are OPEN strings
 * (drop-in formats may add kinds); deckMeta falls back gracefully for unknown ones.
 * Also owns the --a convention: accentVars mints the pair every accent-wearing root paints.
 */
import { deepAccent, normalizeHex } from "./color-math";

export interface DeckMeta {
  /** canonical kind ("character") */
  kind: string;
  /** the deck's plural display name ("Characters") */
  plural: string;
  /** short tag for tabs/chips ("char") */
  short: string;
  /** the deck's accent: a `var(--deck-*)` reference into tokens.css (hues live THERE, the
   *  no-hardcode doctrine). Only ever consumed in CSS contexts (`--a`/`--spine` style props). */
  accent: string;
}

const DECKS: DeckMeta[] = [
  { kind: "character", plural: "Characters", short: "char", accent: "var(--deck-character)" },
  { kind: "lorebook", plural: "Lorebooks", short: "lore", accent: "var(--deck-lorebook)" },
  { kind: "persona", plural: "Personas", short: "pers", accent: "var(--deck-persona)" },
  { kind: "pack", plural: "Sprite packs", short: "pack", accent: "var(--deck-pack)" },
  { kind: "preset", plural: "Presets", short: "set", accent: "var(--deck-preset)" },
  { kind: "regex", plural: "Regex sets", short: "rgx", accent: "var(--deck-regex)" },
];

const BY_KIND = new Map(DECKS.map((d) => [d.kind, d]));

/** Known decks in display order. */
export const knownDecks = (): DeckMeta[] => [...DECKS];

/**
 * The style pair an accent-wearing root paints: --a (borders, spines, marks) plus --a-deep
 * (TEXT-BEARING fills; white labels on it clear AA). A piece accent is a hex, a deck accent is a
 * var(--deck-*) reference whose -deep twin lives in tokens.css; anything else omits --a-deep so
 * CSS falls back to var(--accent-deep). No accent -> undefined (the var() fallback chains rule).
 */
export function accentVars(accent: string | undefined): Record<string, string> | undefined {
  if (!accent) return undefined;
  const hex = normalizeHex(accent);
  if (hex) return { "--a": accent, "--a-deep": deepAccent(hex) };
  const deck = accent.match(/^var\(--deck-([a-z]+)\)$/);
  if (deck) return { "--a": accent, "--a-deep": `var(--deck-${deck[1]}-deep)` };
  return { "--a": accent };
}

/** Meta for any kind; unknown kinds get a readable fallback (open-by-design). */
export function deckMeta(kind: string): DeckMeta {
  return (
    BY_KIND.get(kind) ?? {
      kind,
      plural: kind.charAt(0).toUpperCase() + kind.slice(1) + "s",
      short: kind.slice(0, 4),
      accent: "var(--deck-fog)",
    }
  );
}
