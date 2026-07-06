/**
 * Deck view: LIST - dense rows for big collections: small art thumb, name, kind tag, workbench state.
 * The size pick scales the thumb.
 */
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { useContextMenu } from "../../../shell/store";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.dv-listscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.6rem,1.4vw,.9rem)}
.dv-list{display:flex;flex-direction:column;gap:.35rem}
.dv-row{display:flex;align-items:center;gap:.7rem;width:100%;text-align:left;font:inherit;cursor:pointer;
  background:#111015;border:3px solid #000;padding:.35rem .55rem;transition:transform .1s ease-out}
.dv-row:hover{transform:translate(-1px,-1px);border-color:var(--a)}
.dv-row .thumb{width:calc(var(--card-w) * .28);aspect-ratio:2/3;flex:none;background:var(--a);border:2px solid #000;
  background-size:cover;background-position:center top;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-big);font-weight:900;color:#0a0a0c}
.dv-row .nm{font-family:var(--font-big);font-weight:800;font-size:.8rem;color:#f4f1ee}
.dv-row .kd{font-family:var(--font-mono);font-size:.625rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#a6a1b4}
.dv-row .bench{margin-left:auto;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--a);border:2px solid var(--a);padding:2px 6px}
.dv-row.cast{border-color:var(--a);background:#0d0c11;opacity:.72}
.dv-row.pick{border-color:var(--a);background:#0d0c11;box-shadow:inset 4px 0 0 0 var(--a)}
.dv-row .stag{margin-left:auto;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;color:#0a0a0c;background:var(--a);padding:2px 7px;font-weight:700}
`;

function ListRow({ ctx, e }: { ctx: DeckViewContext; e: StudioEntitySummary }): JSX.Element {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const art = ctx.portraitUrl(e);
  const fmt = ctx.sourceLabel(e);
  const title = isOpen
    ? `${e.name} is open on the Workbench`
    : staged
      ? `${e.name} is staged - tap to unstage`
      : `Stage ${e.name} for the Workbench`;

  return (
    <button
      ref={menuRef}
      className={`dv-row${isOpen ? " cast" : ""}${staged ? " pick" : ""}`}
      style={{ "--a": e.accent ?? deckMeta(e.kind).accent } as CSSProperties}
      title={title}
      onClick={() => ctx.onPiece(e)}
    >
      <span className="thumb" style={art ? ({ backgroundImage: `url("${art}")` } as CSSProperties) : undefined}>
        {!art && e.name.charAt(0).toUpperCase()}
      </span>
      <span className="nm">{e.name}</span>
      <span className="kd">{e.kind}</span>
      {fmt && <span className="kd">{fmt}</span>}
      {isOpen && <span className="bench">on the workbench</span>}
      {!isOpen && staged && <span className="stag">staged</span>}
    </button>
  );
}

const view: DeckView = {
  id: "list",
  label: "List",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  order: 30,
  css: CSS,
  Component({ ctx }) {
    return (
      <div className="dv-listscroll">
        <div className="dv-list">
          {ctx.entities.map((e) => (
            <ListRow key={pieceKey(e)} ctx={ctx} e={e} />
          ))}
        </div>
      </div>
    );
  },
};

export default view;
