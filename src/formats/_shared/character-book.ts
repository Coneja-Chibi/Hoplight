/**
 * The embedded CCv2/v3 `character_book` mapper, both directions.
 *
 * A FACADE. The two halves live apart because the file outgrew this repository line cap, and the
 * seam is the honest one: reading a book off a card and writing one back are separate jobs with
 * separate hazards. Decode is deliberately tolerant - it reads the CCv3 top level and the
 * extensions bag, first-defined wins - while encode has to be exact, because what it emits is what
 * somebody else parses.
 *
 * Callers keep importing from here so the split changed no import in the repository.
 */
export * from "./character-book-decode";
export * from "./character-book-encode";
