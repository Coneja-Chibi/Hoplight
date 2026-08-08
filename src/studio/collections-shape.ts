/**
 * Collections - the pure shape, parser and edits (functional core; the fs store lives in
 * collections.ts). A collection is somebody's own grouping of pieces: a cast, a series, the four
 * things they are working on this week. The studio's folders are decided by KIND, which is a fact
 * about a piece rather than a decision by its author, so there was nowhere to put "these belong
 * together" until now.
 *
 * MEMBERSHIP IS REFERENCES, NEVER COPIES. A collection stores `{kind, id}` and nothing else, so the
 * piece keeps exactly one home on disk and editing it through any door updates what the collection
 * holds. Embedding pieces would fork the store the first time somebody edited one - the same
 * duplicated-authority bug that has cost this session more time than any other.
 *
 * A REFERENCE CAN GO STALE, and that is handled where it is read rather than prevented here: pieces
 * are deleted and renamed by tools that know nothing about collections. See `resolveCollection`.
 */

/** A piece by kind and id. Deliberately not an EntitySummary: this is what survives on disk. */
export interface PieceRef {
  readonly kind: string;
  readonly id: string;
}

export interface Collection {
  /** Stable slug, used in `@collection:<id>` and never changed by a rename. */
  readonly id: string;
  /** What the person typed. Theirs to change. */
  readonly name: string;
  readonly note?: string;
  readonly members: readonly PieceRef[];
}

export interface CollectionsFile {
  readonly collections: readonly Collection[];
}

export const EMPTY_COLLECTIONS: CollectionsFile = { collections: [] };

/** The kind marker collections travel under in mentions and pickers. Not a studio deck kind. */
export const COLLECTION_KIND = "collection";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const sameRef = (a: PieceRef, b: PieceRef): boolean => a.kind === b.kind && a.id === b.id;

/**
 * A filename-safe, mention-safe slug for a name somebody typed.
 *
 * The alphabet is deliberately narrow. This id ends up inside `@collection:<id>`, where a space
 * would end the mention early and a colon would split it in the wrong place - so the marker would
 * point at something other than what was picked.
 */
export function slugFor(name: string, taken: readonly string[] = []): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  /**
   * A name of pure punctuation or a script this alphabet cannot spell still deserves a collection,
   * so it gets a generic stem rather than an empty id or a refusal.
   */
  const stem = base || COLLECTION_KIND;
  if (!taken.includes(stem)) return stem;
  // Two collections may share a name - people name things "new" twice - but never an id.
  for (let n = 2; ; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

const parseRef = (raw: unknown): PieceRef | null => {
  if (!isRecord(raw)) return null;
  const { kind, id } = raw;
  if (typeof kind !== "string" || kind === "") return null;
  if (typeof id !== "string" || id === "") return null;
  return { kind, id };
};

const parseCollection = (raw: unknown): Collection | null => {
  if (!isRecord(raw)) return null;
  const { id, name, note, members } = raw;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string" || name === "") return null;
  const list = Array.isArray(members) ? members : [];
  const seen: PieceRef[] = [];
  for (const entry of list) {
    const ref = parseRef(entry);
    // A malformed member is dropped; the rest of the collection is still somebody's work.
    if (ref && !seen.some((held) => sameRef(held, ref))) seen.push(ref);
  }
  return { id, name, members: seen, ...(typeof note === "string" && note ? { note } : {}) };
};

/**
 * Tolerant, fail-closed reader: anything malformed reads as absent, never throws.
 *
 * PER COLLECTION, not per file - the same rule parseSettings follows. One collection written by a
 * newer version, or hand-edited into nonsense, must not take the other eleven down with it.
 */
export function parseCollections(raw: unknown): CollectionsFile {
  const list = isRecord(raw) && Array.isArray(raw["collections"]) ? raw["collections"] : [];
  const out: Collection[] = [];
  for (const entry of list) {
    const parsed = parseCollection(entry);
    // A duplicate id would make `@collection:x` ambiguous; first one on disk wins.
    if (parsed && !out.some((held) => held.id === parsed.id)) out.push(parsed);
  }
  return { collections: out };
}

/**
 * The vocabulary of changes, spelled ONCE for both sides of the wire.
 *
 * The client sends one of these, the route parses into one of these, and the app contract names this
 * type. Declaring the same five edits separately per layer is how the damage-reason union ended up
 * with four of its five cases in one copy and the word "undefined" on somebody's screen.
 */
export type CollectionEdit =
  | { readonly action: "create"; readonly name: string; readonly note?: string }
  | { readonly action: "rename"; readonly id: string; readonly name: string }
  | { readonly action: "delete"; readonly id: string }
  | { readonly action: "add"; readonly id: string; readonly ref: PieceRef }
  | { readonly action: "remove"; readonly id: string; readonly ref: PieceRef };

/** Apply one edit. Pure: callers hand in the current file and store what comes back. */
export function applyCollectionEdit(
  current: CollectionsFile,
  edit: CollectionEdit,
): CollectionsFile {
  switch (edit.action) {
    case "create": return createCollection(current, edit.name, edit.note).file;
    case "rename": return renameCollection(current, edit.id, edit.name);
    case "delete": return deleteCollection(current, edit.id);
    case "add": return addToCollection(current, edit.id, edit.ref);
    case "remove": return removeFromCollection(current, edit.id, edit.ref);
  }
}

export function createCollection(
  file: CollectionsFile,
  name: string,
  note?: string,
): { readonly file: CollectionsFile; readonly created: Collection } {
  const created: Collection = {
    id: slugFor(name, file.collections.map((c) => c.id)),
    name,
    members: [],
    ...(note ? { note } : {}),
  };
  return { file: { collections: [...file.collections, created] }, created };
}

/** Replace one collection by id, leaving the rest untouched. Unknown id is a no-op. */
const mapOne = (
  file: CollectionsFile,
  id: string,
  change: (collection: Collection) => Collection,
): CollectionsFile => ({
  collections: file.collections.map((c) => (c.id === id ? change(c) : c)),
});

/**
 * The name changes; THE ID DOES NOT. Every `@collection:<id>` already written into a transcript
 * keeps pointing at this collection, which is the whole reason the id is a separate field.
 */
export function renameCollection(file: CollectionsFile, id: string, name: string): CollectionsFile {
  if (!name) return file;
  return mapOne(file, id, (c) => ({ ...c, name }));
}

export function deleteCollection(file: CollectionsFile, id: string): CollectionsFile {
  return { collections: file.collections.filter((c) => c.id !== id) };
}

/**
 * Add a piece. IDEMPOTENT, because adding the same piece twice is something people do by accident
 * and a collection listing a character twice is a bug that looks like data.
 */
export function addToCollection(
  file: CollectionsFile,
  id: string,
  ref: PieceRef,
): CollectionsFile {
  return mapOne(file, id, (c) =>
    c.members.some((held) => sameRef(held, ref)) ? c : { ...c, members: [...c.members, ref] });
}

export function removeFromCollection(
  file: CollectionsFile,
  id: string,
  ref: PieceRef,
): CollectionsFile {
  return mapOne(file, id, (c) => ({
    ...c,
    members: c.members.filter((held) => !sameRef(held, ref)),
  }));
}

/** Which collections hold this piece. Drives the badge on a piece and "remove from" menus. */
export function collectionsHolding(
  file: CollectionsFile,
  ref: PieceRef,
): readonly Collection[] {
  return file.collections.filter((c) => c.members.some((held) => sameRef(held, ref)));
}

/** A member paired with the live piece it points at, or nothing when that piece is gone. */
export interface ResolvedMembers<TPiece extends PieceRef> {
  readonly present: readonly TPiece[];
  /**
   * Members whose piece is no longer in the studio. REPORTED, NOT SWALLOWED: a collection that
   * quietly shrinks by one looks like the app lost something, and the person is the only one who
   * knows whether that piece was deleted on purpose or the folder is mounted wrong.
   */
  readonly missing: readonly PieceRef[];
}

/**
 * Resolve membership against the live inventory, IN THE ORDER THE PERSON ADDED THEM.
 *
 * Sorting by name here would throw away the one piece of information a hand-built collection
 * carries that a search result does not: the order somebody chose.
 */
export function resolveCollection<TPiece extends PieceRef>(
  collection: Collection,
  live: readonly TPiece[],
): ResolvedMembers<TPiece> {
  const present: TPiece[] = [];
  const missing: PieceRef[] = [];
  for (const ref of collection.members) {
    const found = live.find((piece) => sameRef(piece, ref));
    if (found) present.push(found);
    else missing.push(ref);
  }
  return { present, missing };
}
