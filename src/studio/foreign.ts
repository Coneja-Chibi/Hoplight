/**
 * Reading a file in the studio folder that is not one of ours.
 *
 * A real studio held 147 preset files and Kit listed three: the other 144 were SillyTavern exports,
 * dropped in the folder because that is where somebody's presets go. Every one of them is readable -
 * measured, 137 of 147 detect and 137 of 137 convert without throwing - by adapters this repository
 * has shipped the whole time. Nothing was missing except the call.
 *
 * THE RAW FILE IS NEVER WRITTEN. Its id is derived from the filename and slugified, so saving an
 * edit writes `<slug>.json` beside it and cannot land on `Aegir Main.json`. That is a structural
 * guarantee rather than a rule to remember: the two names are different files.
 *
 * The reader itself is INJECTED. Detection lives in the format registry, which is registered at the
 * app layer; a studio that imported it would invert the dependency this folder is arranged to avoid.
 */

/** What a foreign file turned into, plus which format recognised it. */
export interface ForeignPiece {
  /** The canonical entity the adapter produced. Never written back to the source file. */
  entity: { kind: string; body: unknown; id?: string };
  /** The adapter that recognised it, for the summary's source column. */
  format: string;
}

/**
 * Detect and convert one file, or null when nothing recognises it. Must never throw.
 *
 * ASYNC because registering the format graph is. Kit loads adapters lazily - a static import would
 * pull every codec into its cold start for work most sessions never do - so the reader has to be
 * able to await that registration. The first version was synchronous, which meant it ran against an
 * empty registry and quietly found nothing: a studio of 140 readable presets listed 3, and the
 * script that proved otherwise had registered the formats itself.
 */
export type ForeignReader = (
  bytes: Uint8Array,
  filename: string,
  kind: string,
) => Promise<ForeignPiece | null>;

/**
 * A safe, stable id for a file whose name cannot be one.
 *
 * Lowercased, spaces and punctuation collapsed to single hyphens, trimmed. Stability is the property
 * that matters: the same filename must always produce the same id, or a piece would change identity
 * between two listings and every reference to it would rot.
 *
 * Collisions are possible by construction (`My Preset.json` and `my-preset.json` slugify alike) and
 * are resolved by the caller, which can see the whole folder; a slug function that could not be
 * computed from one name alone would not be stable.
 */
export function foreignId(filename: string): string {
  const stem = filename.replace(/\.json$/i, "");
  const slug = stem
    .normalize("NFKD")
    // Strip combining marks so an accented name slugs to its base letters rather than to nothing.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  // A name made entirely of punctuation or emoji leaves nothing behind; it still needs an id, and an
  // empty one would resolve to the kind directory itself.
  return slug.length > 0 ? slug.slice(0, 100) : "untitled";
}

/** Make an id unique against ones already taken, preserving the first claim. */
export function uniqueForeignId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${taken.size}`;
}
