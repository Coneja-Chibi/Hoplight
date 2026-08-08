/**
 * The Library's collections chrome: a row of the person's own groupings, and the control that puts
 * staged pieces into one.
 *
 * A renderer. Every decision about what a collection is, what an edit does, and which pieces are in
 * one lives in collections-shape.ts and collections-ops.ts, so this file holds nothing worth testing
 * without a browser.
 *
 * BROWSING A COLLECTION IS A SEARCH. Clicking a chip writes `collection:<id>` into the box that was
 * already there, which is why this file has no shelf, no empty state and no view modes of its own -
 * the room it filters is the room that already works. It also means the person can SEE why the shelf
 * changed, and can edit or delete the term by hand like any other.
 */
import { useState, type JSX } from "react";
import {
  collectionQuery,
  collectionsBarProps,
  type CollectionsBarInput,
} from "./collections-ops";

export function CollectionsBar(input: CollectionsBarInput): JSX.Element | null {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  /**
   * THE BAR REPORTS ITS OWN OUTCOMES. The mono status bar cannot carry them - see the note on
   * `say` in collections-ops.ts, where the room's status effect was watched overwriting a handler's
   * message in the same tick. A failed write with nowhere to say so is the case that matters.
   */
  const [notice, setNotice] = useState("");
  const { all, query, onQuery, staged, onCreate, onAddStaged, onDelete } =
    collectionsBarProps({ ...input, say: setNotice });

  /**
   * NOTHING AT ALL UNTIL THERE IS SOMETHING TO SHOW. A row of chrome for a feature somebody has
   * never used is a permanent tax on the shelf; the New button appears with the first staged piece,
   * which is the moment making a collection first means anything.
   */
  if (all.length === 0 && staged.length === 0) return null;

  const commit = (): void => {
    const name = draft.trim();
    if (name) onCreate(name);
    setDraft("");
    setNaming(false);
  };

  return (
    <div className="colbar">
      <span className="sk">groups</span>
      {all.map((collection) => {
        const on = query.trim() === collectionQuery(collection.id);
        return (
          <span key={collection.id} className={`colchip${on ? " on" : ""}`}>
            <button
              type="button"
              className="colname"
              title={
                on
                  ? "Showing this collection - click to stop filtering"
                  : `Show only what is in ${collection.name}`
              }
              // A second click clears it. Without that the only way out of a collection is to find
              // and delete the term by hand, which is a trap for anyone who clicked to look.
              onClick={() => onQuery(on ? "" : collectionQuery(collection.id))}
            >
              {collection.name}
              <span className="colcount">{collection.members.length}</span>
            </button>
            {staged.length > 0 && (
              <button
                type="button"
                className="coladd"
                title={`Add ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"} to ${collection.name}`}
                onClick={() => onAddStaged(collection.id)}
              >
                add
              </button>
            )}
            <button
              type="button"
              className="coldel"
              title={`Delete the collection ${collection.name}. The pieces stay in the studio.`}
              onClick={() => onDelete(collection)}
            >
              remove
            </button>
          </span>
        );
      })}

      {naming ? (
        <input
          className="colnew"
          autoFocus
          value={draft}
          maxLength={120}
          placeholder="name this group"
          aria-label="Name the new collection"
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") commit();
            if (ev.key === "Escape") {
              // Leaving the field is a commit, so Escape has to clear the draft BEFORE the blur
              // lands or backing out would create the collection anyway.
              ev.stopPropagation();
              setDraft("");
              setNaming(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="colmake"
          title={
            staged.length > 0
              ? `Make a collection from the ${String(staged.length)} staged ${staged.length === 1 ? "piece" : "pieces"}`
              : "Make a collection"
          }
          onClick={() => setNaming(true)}
        >
          new group
        </button>
      )}

      {notice && (
        <span className="colnote" role="status">
          {notice}
          <button type="button" title="Dismiss" aria-label="Dismiss" onClick={() => setNotice("")}>
            ok
          </button>
        </span>
      )}
    </div>
  );
}
