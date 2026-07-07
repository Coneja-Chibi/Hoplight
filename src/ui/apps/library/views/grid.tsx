/**
 * Deck view: GRID - the workhorse. Portrait 2:3 cards in a fluid auto-fill grid sized by the
 * user's art dial. Tapping a card STAGES it (accent ring + corner check); cards already open on
 * the Workbench wear a quiet "on the workbench" tick (a pure annotation). The naive-user default.
 */
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.dv-gridscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
/* the 42vw guard keeps at least two columns on a phone even when the desktop size dial is huge */
.dv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card-w),42vw,100%),1fr));gap:clamp(.5rem,1.4vw,1rem)}
.dv-gcard{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out}
.dv-gcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 0 var(--a)}
.dv-gcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.dv-gcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,26cqi,2.6rem);line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-gcard .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
.dv-gcard .bd{padding:.4rem .5rem .5rem}
/* name + meta tag scale with the size dial (--card-w); name stays the larger of the two at every size */
.dv-gcard .nm{font-family:var(--font-big);font-weight:800;font-size:clamp(.72rem,calc(var(--card-w) * .094),1.6rem);color:var(--stage-card);line-height:1}
.dv-gcard .fmt{display:inline-block;font-family:var(--font-mono);font-size:clamp(.38rem,calc(var(--card-w) * .036),.62rem);letter-spacing:.06em;
  text-transform:uppercase;color:#b3aec0;border:2px solid #4a4656;font-weight:700;padding:.28em .55em;margin-top:.4em}
.dv-gcard.cast{border-color:var(--a);box-shadow:inset 5px 5px 0 0 rgba(0,0,0,.45);transform:translate(2px,2px);opacity:.72}
.dv-gcard.cast:hover{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 0 rgba(0,0,0,.45)}
.dv-gcard .tick{position:absolute;top:0;right:0;z-index:1;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* STAGED: outlined in accent, a filled corner check - distinct from the pressed-open "cast" state */
.dv-gcard.pick{outline:3px solid var(--a);outline-offset:-3px;box-shadow:9px 9px 0 0 var(--a);transform:translate(-3px,-3px)}
.dv-gcard .check{position:absolute;top:0;right:0;z-index:2;width:1.15rem;height:1.15rem;background:var(--a);
  border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black);display:flex;align-items:center;justify-content:center}
.dv-gcard .check::after{content:"";width:.42rem;height:.72rem;border:solid var(--stage-ink);border-width:0 3px 3px 0;
  transform:translateY(-2px) rotate(45deg)}
`;

function GridCard({ ctx, e }: { ctx: DeckViewContext; e: StudioEntitySummary }): JSX.Element {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
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
      className={`dv-gcard${isOpen ? " cast" : ""}${staged ? " pick" : ""}`}
      style={{ "--a": e.accent ?? deckMeta(e.kind).accent } as CSSProperties}
      title={title}
      onClick={() => ctx.onPiece(e)}
    >
      <div className="cov" style={art ? ({ backgroundImage: `url("${art}")` } as CSSProperties) : undefined}>
        {!art && <b>{e.name.charAt(0).toUpperCase()}</b>}
        <span className="kd">{e.kind}</span>
      </div>
      <div className="bd">
        <div className="nm">{e.name}</div>
        {fmt && <span className="fmt">{fmt}</span>}
      </div>
      {isOpen && <span className="tick">on the workbench</span>}
      {staged && <span className="check" />}
    </button>
  );
}

const view: DeckView = {
  id: "grid",
  label: "Grid",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  order: 10,
  css: CSS,
  Component({ ctx }) {
    return (
      <div className="dv-gridscroll">
        <div className="dv-grid">
          {ctx.entities.map((e) => (
            <GridCard key={pieceKey(e)} ctx={ctx} e={e} />
          ))}
        </div>
      </div>
    );
  },
};

export default view;
