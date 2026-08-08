/**
 * The Library's side of collections: loading them, editing them, and attaching membership to the
 * pieces the shelf is about to search.
 *
 * WHY A COLLECTION IS A SEARCH TERM AND NOT A SEVENTH DECK. The obvious build is a new shelf you
 * switch to, and it would have meant a second browsing surface: its own empty state, its own view
 * modes, its own staging, its own agent brief. Membership as a FILTER (`collection:the-cast`) reuses
 * the room that already exists - the chips count matches across every deck, the view segment still
 * works, staging still works, and the agent surface already reports "filtered" with the query in it.
 * One idea, expressed in the room's own grammar, instead of a parallel one beside it.
 *
 * THE SERVER'S COPY IS THE ONLY ONE. Every edit returns the whole file as it was stored, and that is
 * what lands in state; nothing here patches a local copy optimistically. Edits are cheap, rare, and
 * two of them overlapping is exactly the case a grouping feature invites.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppContext } from "../../app-contract";
import {
  type Collection,
  type CollectionEdit,
  type CollectionsFile,
  EMPTY_COLLECTIONS,
  type PieceRef,
} from "../../../studio/collections-shape";

/** What the room hands the bar. The handlers are built from it inside the bar, which owns the notice. */
export interface CollectionsBarInput {
  room: CollectionsRoom;
  query: string;
  setQuery: (next: string) => void;
  staged: readonly PieceRef[];
}

/**
 * What the bar needs. Declared here rather than beside the renderer so the builder below can name
 * its own return type without the two files importing each other.
 */
export interface CollectionsBarProps {
  all: readonly Collection[];
  /** the live query, so the chip matching it can show as the one being browsed */
  query: string;
  onQuery: (next: string) => void;
  /** the pieces currently staged; the "add to" control is only meaningful when there are some */
  staged: readonly PieceRef[];
  onCreate: (name: string) => void;
  onAddStaged: (collectionId: string) => void;
  onDelete: (collection: Collection) => void;
}

export interface CollectionsRoom {
  readonly all: readonly Collection[];
  /** `kind:id` -> the collections holding it, rebuilt only when the collections themselves change. */
  readonly index: ReadonlyMap<string, string[]>;
  /** Run one edit and take the server's answer. Resolves to the collection touched, when there is one. */
  edit: (edit: CollectionEdit) => Promise<Collection | null>;
  /** Which collections hold this piece, for the "add to" menu's ticks. */
  holding: (ref: PieceRef) => readonly Collection[];
}

const sameRef = (a: PieceRef, b: PieceRef): boolean => a.kind === b.kind && a.id === b.id;

/**
 * Membership, keyed the way the shelf asks for it.
 *
 * Built once per collections change rather than walked per piece: a studio of 169 pieces against a
 * dozen collections is 2,000 comparisons on every keystroke otherwise, and search already runs on
 * every render of the room.
 */
export function membershipIndex(file: CollectionsFile): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const collection of file.collections) {
    for (const ref of collection.members) {
      const key = `${ref.kind}:${ref.id}`;
      const held = index.get(key);
      if (held) held.push(collection.id);
      else index.set(key, [collection.id]);
    }
  }
  return index;
}

/**
 * Give each piece the ids of the collections holding it.
 *
 * Shaped exactly like attachSearchKeys, and for the same reason: a piece cannot know this about
 * itself, so the room attaches it before the search core ever sees the list.
 */
export function attachCollections<T extends { kind: string; id: string }>(
  pieces: readonly T[],
  index: ReadonlyMap<string, string[]>,
): (T & { collections?: readonly string[] })[] {
  return pieces.map((piece) => {
    const held = index.get(`${piece.kind}:${piece.id}`);
    // Absent, not empty: the search core reads `collections?.includes(...)`, and an empty array on
    // every piece is a hundred and sixty-nine allocations that answer the same "no".
    return held ? { ...piece, collections: held } : piece;
  });
}

/** The query that shows exactly one collection. Spelled once so the bar and any caller agree. */
export const collectionQuery = (id: string): string => `collection:${id}`;

/**
 * Everything the bar does, built where it can be read in one piece.
 *
 * It lives here rather than in the room's JSX for the ordinary reason - index.tsx is seven lines
 * under its cap - and one better one: these are the only writes in this app that touch somebody's
 * filing, and the whole of that is worth reading at once.
 */
export function collectionsBarProps(input: {
  /**
   * Where an outcome is reported - THE BAR'S OWN LINE, not the mono status bar, and this was
   * measured rather than assumed.
   *
   * `ctx.setStatus` cannot work from a handler here. The shell rebuilds the whole AppContext on
   * every store action by deliberate design ("staleness is a structural impossibility"), so setting
   * the status changes the store, which rebuilds ctx, which re-runs the room's own status effect,
   * which sets it straight back to the shelf count. Watched live: the line after adding to a group
   * was the shelf's, not the handler's. A message nobody can see is worse than none, because the
   * code reads as though failures are reported.
   */
  say: (text: string) => void;
  room: CollectionsRoom;
  query: string;
  setQuery: (next: string) => void;
  staged: readonly PieceRef[];
}): CollectionsBarProps {
  const { room, query, setQuery, staged, say } = input;

  const count = (n: number, word = "piece"): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

  /**
   * Add every staged piece, one edit each.
   *
   * SEQUENTIAL, NOT IN PARALLEL. The store serialises writes, so parallel edits would be correct -
   * but each one returns the whole file and the last answer to arrive wins the state. In order, the
   * last answer is also the complete one.
   */
  const addAll = async (id: string, refs: readonly PieceRef[]): Promise<void> => {
    for (const ref of refs) await room.edit({ action: "add", id, ref });
  };

  return {
    all: room.all,
    query,
    onQuery: setQuery,
    staged,
    onCreate: (name) => {
      void (async () => {
        try {
          const made = await room.edit({ action: "create", name });
          if (!made) return;
          await addAll(made.id, staged);
          /**
           * Show it immediately. Making a group out of staged pieces and being left looking at the
           * whole deck is the moment somebody wonders whether it worked.
           */
          if (staged.length) setQuery(collectionQuery(made.id));
          say(
            staged.length
              ? `made ${made.name} · ${count(staged.length)}`
              : `made ${made.name} · empty for now`,
          );
        } catch {
          say("could not make that collection");
        }
      })();
    },
    onAddStaged: (id) => {
      void (async () => {
        const before = room.all.find((c) => c.id === id);
        try {
          await addAll(id, staged);
          /**
           * Reports what CHANGED, not what was sent. Adding is idempotent, so five staged pieces
           * against a group already holding three of them is two new members - and saying "added 5"
           * there would be a small lie somebody could check.
           */
          const held = new Set((before?.members ?? []).map((m) => `${m.kind}:${m.id}`));
          const added = staged.filter((ref) => !held.has(`${ref.kind}:${ref.id}`)).length;
          say(
            added === 0
              ? `${before?.name ?? "that group"} already had ${staged.length === 1 ? "it" : "them"}`
              : `${before?.name ?? "group"} · added ${count(added)}`,
          );
        } catch {
          say("could not add to that collection");
        }
      })();
    },
    onDelete: (collection) => {
      void room.edit({ action: "delete", id: collection.id }).then(
        () => {
          // Browsing the group that just went would leave the shelf filtered by an id nothing has,
          // which reads as an empty studio.
          if (query.trim() === collectionQuery(collection.id)) setQuery("");
          say(`removed the group ${collection.name} · its ${count(collection.members.length)} stayed`);
        },
        () => say("could not remove that collection"),
      );
    },
  };
}

export function useCollections(ctx: AppContext): CollectionsRoom {
  const [file, setFile] = useState<CollectionsFile>(EMPTY_COLLECTIONS);

  useEffect(() => {
    let alive = true;
    void ctx.api.collections()
      .then((got) => { if (alive) setFile(got); })
      // No groupings is the ordinary state of a new studio, and an unreachable one must not take
      // the shelves down with it - the room works perfectly without this feature.
      .catch(() => { /* leave it empty */ });
    return () => { alive = false; };
  }, [ctx]);

  const edit = useCallback(async (change: CollectionEdit): Promise<Collection | null> => {
    const got = await ctx.api.collectionEdit(change);
    setFile(got);
    /**
     * WHICH ONE WAS TOUCHED, found in the server's answer rather than assumed. A create does not
     * know its own id in advance - the slug is decided server-side, and it may have gained a "-2"
     * to avoid colliding - so the caller has to be told, not guess from the name it sent.
     */
    if (change.action === "create") {
      return got.collections.at(-1) ?? null;
    }
    if (change.action === "delete") return null;
    return got.collections.find((c) => c.id === change.id) ?? null;
  }, [ctx]);

  const holding = useCallback(
    (ref: PieceRef) => file.collections.filter((c) => c.members.some((m) => sameRef(m, ref))),
    [file],
  );

  const index = useMemo(() => membershipIndex(file), [file]);

  return useMemo(
    () => ({ all: file.collections, index, edit, holding }),
    [file, index, edit, holding],
  );
}
