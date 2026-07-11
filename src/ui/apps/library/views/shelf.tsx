/**
 * Deck view: SHELF - lorebook spine cards (vs-lore-shelf). For non-lorebook decks, falls
 * back to a compact monogram grid so the view is never empty of meaning.
 */
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.dv-shelfscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.dv-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(11.5rem,100%),1fr));gap:.85rem}
.dv-book{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out;
  --spine:var(--a)}
.dv-book:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--a)}
.dv-book .spine{position:absolute;left:0;top:0;bottom:0;width:.45rem;background:var(--spine);border-right:2px solid var(--stage-black)}
.dv-book .body{padding:.7rem .7rem .7rem 1.05rem;display:flex;flex-direction:column;gap:.35rem;min-height:6.5rem}
.dv-book .nm{font-family:var(--font-big);font-weight:800;font-size:.95rem;color:var(--stage-card);line-height:1.1}
.dv-book .meta{font-family:var(--font-mono);font-size:.52rem;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-kicker)}
.dv-book.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.78}
.dv-book.pick{outline:3px solid var(--a);outline-offset:-3px}
.dv-book.off .nm{text-decoration:line-through;color:var(--stage-mute)}
.dv-book.off{opacity:.55}
.dv-book .tick{position:absolute;top:0;right:0;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size:.5rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-left:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
`;

function BookCard({ ctx, e }: { ctx: DeckViewContext; e: StudioEntitySummary }): JSX.Element {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const accent = e.accent ?? deckMeta(e.kind).accent;
  // Book-level enabled rides entity meta when present; absent = on.
  const off = (e as StudioEntitySummary & { bookEnabled?: boolean }).bookEnabled === false;

  return (
    <button
      ref={menuRef}
      className={`dv-book${isOpen ? " cast" : ""}${staged ? " pick" : ""}${off ? " off" : ""}`}
      style={{ "--a": accent, "--spine": accent } as CSSProperties}
      title={isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`}
      onClick={() => ctx.onPiece(e)}
    >
      <span className="spine" aria-hidden="true" />
      <div className="body">
        <div className="nm">{e.name || "(unnamed)"}</div>
        <div className="meta">{e.kind === "lorebook" ? "lorebook" : e.kind}</div>
        {e.provenance && <div className="meta">{e.provenance}</div>}
      </div>
      {isOpen && <span className="tick">open</span>}
    </button>
  );
}

const view: DeckView = {
  id: "shelf",
  label: "Shelf",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 19h16"/><path d="M6 19V7l4 2 4-2 4 2v10"/><path d="M10 9v10"/><path d="M14 9v10"/></svg>',
  order: 15,
  css: CSS,
  Component({ ctx }) {
    return (
      <div className="dv-shelfscroll">
        <div className="dv-shelf">
          {ctx.entities.map((e) => (
            <BookCard key={pieceKey(e)} ctx={ctx} e={e} />
          ))}
        </div>
      </div>
    );
  },
};

export default view;
