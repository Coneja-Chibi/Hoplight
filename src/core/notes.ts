/**
 * Adding, editing and removing an author's notes on a piece.
 *
 * PURE, AND ON PURPOSE. These take an entity and return a new one; nothing here reads a clock, mints
 * an id, touches disk, or knows a studio exists. Kit calls them behind its gate, the Workbench calls
 * them from an editor, and both get identical results - which is the only way "the note you wrote in
 * Kit is the note the Workbench shows" stays true rather than aspirational.
 *
 * The clock and the id generator are ARGUMENTS rather than imports, because a note carries a
 * timestamp and a test that cannot fix time cannot assert on one.
 */
import type { EntityNote } from "./canonical";

/**
 * The slice of an entity these functions touch.
 *
 * Callers are constrained to `object` rather than to this shape, because a type whose only member is
 * optional is a WEAK TYPE: TypeScript rejects an argument that shares no property with it, so a real
 * entity that simply has no notes yet would fail to compile. The narrowing happens inside instead.
 */
export interface Annotated {
  notes?: EntityNote[];
}

export interface NoteStamp {
  id: string;
  at: string;
  by?: string;
}

/** Every note on a piece, oldest first. Absent and empty are the same answer to a reader. */
export const notesOf = (entity: object): readonly EntityNote[] => (entity as Annotated).notes ?? [];

/**
 * Add a note. Returns a new entity; the input is never mutated, because the caller may be holding
 * the copy a render is currently reading.
 */
export function addNote<T extends object>(entity: T, text: string, stamp: NoteStamp): T & Annotated {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error("notes: a note needs text");
  const note: EntityNote = {
    id: stamp.id,
    text: trimmed,
    at: stamp.at,
    ...(stamp.by ? { by: stamp.by } : {}),
  };
  return { ...entity, notes: [...notesOf(entity), note] };
}

/**
 * Replace one note's text, keeping its id and its author and moving its timestamp forward.
 *
 * Throws on an unknown id rather than appending a new note. A silent insert would turn a typo in an
 * id into a duplicate the author never asked for, and they would have no way to tell which of the
 * two the edit was meant to be.
 */
export function editNote<T extends object>(entity: T, id: string, text: string, at: string): T & Annotated {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error("notes: a note needs text");
  const existing = notesOf(entity);
  if (!existing.some((note) => note.id === id)) {
    throw new Error(`notes: no note "${id}" on this piece`);
  }
  return {
    ...entity,
    notes: existing.map((note) => (note.id === id ? { ...note, text: trimmed, at } : note)),
  };
}

/**
 * Remove one note. Throws on an unknown id, so "deleted" never reports success for something that
 * was not there - a caller told the delete worked will not go looking for the note again.
 */
export function removeNote<T extends object>(entity: T, id: string): T & Annotated {
  const existing = notesOf(entity);
  if (!existing.some((note) => note.id === id)) {
    throw new Error(`notes: no note "${id}" on this piece`);
  }
  const kept = existing.filter((note) => note.id !== id);
  // Drop the key entirely when the last note goes, so an annotated piece and a never-annotated one
  // serialize identically rather than differing by an empty array.
  if (kept.length === 0) {
    const { notes: _dropped, ...rest } = entity as T & Annotated;
    return rest as T & Annotated;
  }
  return { ...entity, notes: kept };
}
