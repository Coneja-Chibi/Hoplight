/**
 * Deck view: GRID - the workhorse. Portrait 2:3 cards in a fluid auto-fill grid sized by the
 * user's art dial. Tapping a card STAGES it (accent ring + corner check); cards already open on
 * the Workbench wear a quiet "on the workbench" tick (a pure annotation). The naive-user default.
 */
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";
import { selectedText } from "../select-core";
import { useMarquee } from "../use-marquee";

const CSS = `
.dv-gridscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
/* the dragged box: fixed, because it is measured in viewport coordinates like the cards it tests */
.dv-lasso{position:fixed;z-index:3;pointer-events:none;border:2px dashed var(--a,var(--stage-line));
  background:var(--stage-sunken);opacity:.35}
/* names are TEXT: an imported preset's id is often the only place its real name is written down */
.dv-gcard .nm{user-select:text;cursor:text}
/* the 42vw guard keeps at least two columns on a phone even when the desktop size dial is huge */
.dv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card-w),42vw,100%),1fr));gap:clamp(.5rem,1.4vw,1rem)}
/* overflow:hidden is the backstop: whatever a name does, it stays inside its own card */
.dv-gcard{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;overflow:hidden;min-width:0;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out}
.dv-gcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 0 var(--a)}
.dv-gcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.dv-gcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,26cqi,2.6rem);line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-gcard .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* min-width:0 lets the name shrink inside the grid track; without it a long word sets the width */
.dv-gcard .bd{padding:.4rem .5rem .5rem;min-width:0}
/* name + meta tag scale with the size dial (--card-w); name stays the larger of the two at every size */
.dv-gcard .nm{font-family:var(--font-big);font-weight:800;font-size:clamp(.72rem,calc(var(--card-w) * .094),1.6rem);color:var(--stage-card);line-height:1.1;
  /*
   * A NAME IS SOMEBODY ELSE'S STRING. Presets arrive called "3035a5467e03eaa245de3ac318018404" and
   * "HawThorne(2)" - one unbroken word far wider than any card. With nothing here it drew straight
   * out of the card and over the neighbours, so a shelf of imports was a wall of overlapping text.
   * Breaking anywhere is right for an id; three lines then hand the rest to the tooltip, which
   * already carries the whole name, so cards in a row stay the same height.
   */
  overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.dv-gcard .fmt{display:inline-block;font-family:var(--font-mono);font-size:clamp(.56rem,calc(var(--card-w) * .05),.72rem);letter-spacing:.06em;
  text-transform:uppercase;color:var(--stage-soft);border:2px solid var(--stage-line);font-weight:700;padding:.24em .5em;margin-top:.4em}
.dv-gcard.cast{border-color:var(--a);box-shadow:inset 5px 5px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.72}
.dv-gcard.cast:hover{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 0 var(--shadow-ink)}
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
      data-pick={key}
      onClick={(ev) => {
        /**
         * A HIGHLIGHT IS NOT A TAP. Names are selectable now, and a card is a button - so dragging
         * across `3035a5467e03eaa245de3ac318018404` to copy it both highlights the text AND fires
         * this click. Without the guard, copying an id stages the piece as a silent side effect.
         */
        if (selectedText(window.getSelection())) return;
        ctx.onPiece(e, { shift: ev.shiftKey, meta: ev.ctrlKey || ev.metaKey });
      }}
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

/**
 * Its own component so the marquee can hold hook state. A DeckView's `Component` is called as a
 * plain function from the registry, which is not a place hooks may live.
 */
function Grid({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  const marquee = useMarquee((cards, box, additive) => { ctx.onSweep?.(cards, box, additive); });
  return (
    <div className="dv-gridscroll" onPointerDown={marquee.onPointerDown}>
      <div className="dv-grid">
        {ctx.entities.map((e) => (
          <GridCard key={pieceKey(e)} ctx={ctx} e={e} />
        ))}
      </div>
      {marquee.box && (
        <div
          className="dv-lasso"
          style={{
            left: marquee.box.left, top: marquee.box.top,
            width: marquee.box.right - marquee.box.left,
            height: marquee.box.bottom - marquee.box.top,
          }}
        />
      )}
    </div>
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
    return <Grid ctx={ctx} />;
  },
};

export default view;
