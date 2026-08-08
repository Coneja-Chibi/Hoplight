/**
 * The integer id an embedded character_book entry goes out with.
 *
 * Its own file because it is a boundary rule with a field report behind it, and because uniqueness
 * across a whole book is a property worth being able to test on its own.
 */

/**
 * The integer id an embedded entry goes out with.
 *
 * REPORTED FROM THE FIELD: SillyTavern refused a card whose embedded book carried GUID entry ids,
 * and hand-editing them to integers made it import clean. Our canonical id is a STRING because it
 * has to hold ids from every format we read, and several of those are not numbers - but this wire
 * dialect is not one of them. ST reads `entry.id` as an integer, so the conversion belongs here,
 * at the boundary, rather than being pushed onto the canonical side where it would break the
 * formats that legitimately use words.
 *
 * A NUMERIC ID KEEPS ITS OWN VALUE. Entries inside a book reference each other by id, so
 * renumbering everything to its position would quietly rewrite those references. Only an id that is
 * not an integer falls back to the entry position, which is what ST assumes for a book that never
 * had ids at all.
 */
export function wireId(raw: string | undefined, index: number, taken: Set<number>): number {
  const parsed = raw !== undefined && /^-?[0-9]+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
  const wanted = Number.isSafeInteger(parsed) ? parsed : index;
  /**
   * TWO ENTRIES MUST NOT SHARE ONE. A book holding an entry numbered 1 beside a worded entry that
   * falls back to position 1 would emit the same id twice, and an importer keying by id keeps one
   * of them. That is the reported failure again with no error message attached, which is worse.
   */
  let id = wanted;
  while (taken.has(id)) id += 1;
  taken.add(id);
  return id;
}
