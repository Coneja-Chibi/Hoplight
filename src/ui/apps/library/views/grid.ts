/**
 * Deck view: GRID - the workhorse. Portrait 2:3 cards in a fluid auto-fill grid sized by the
 * user's art dial. Tapping a card STAGES it (accent ring + corner check); cards already open on
 * the Workbench wear a quiet "on the workbench" tick (a pure annotation). The naive-user default.
 */
import { deckMeta } from "../../../_shared/decks";
import { h, pieceKey, type DeckView } from "../view-contract";

const CSS = `
.dv-gridscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
/* the 42vw guard keeps at least two columns on a phone even when the desktop size dial is huge */
.dv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card-w),42vw,100%),1fr));gap:clamp(.5rem,1.4vw,1rem)}
.dv-gcard{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:#17161d;border:3px solid #000;box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out}
.dv-gcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 0 var(--a)}
.dv-gcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.dv-gcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,26cqi,2.6rem);line-height:.72;color:#0a0a0c;opacity:.82}
.dv-gcard .kd{position:absolute;top:0;left:0;background:#0a0a0c;color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid #000;border-bottom:3px solid #000}
.dv-gcard .bd{padding:.4rem .5rem .5rem}
/* name + meta tag scale with the size dial (--card-w); name stays the larger of the two at every size */
.dv-gcard .nm{font-family:var(--font-big);font-weight:800;font-size:clamp(.72rem,calc(var(--card-w) * .094),1.6rem);color:#f4f1ee;line-height:1}
.dv-gcard .fmt{display:inline-block;font-family:var(--font-mono);font-size:clamp(.38rem,calc(var(--card-w) * .036),.62rem);letter-spacing:.06em;
  text-transform:uppercase;color:#b3aec0;border:2px solid #4a4656;font-weight:700;padding:.28em .55em;margin-top:.4em}
.dv-gcard.cast{border-color:var(--a);box-shadow:inset 5px 5px 0 0 rgba(0,0,0,.45);transform:translate(2px,2px);opacity:.72}
.dv-gcard.cast:hover{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 0 rgba(0,0,0,.45)}
.dv-gcard .tick{position:absolute;top:0;right:0;z-index:1;background:var(--a);color:#0a0a0c;font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-left:3px solid #000;border-bottom:3px solid #000}
/* STAGED: outlined in accent, a filled corner check - distinct from the pressed-open "cast" state */
.dv-gcard.pick{outline:3px solid var(--a);outline-offset:-3px;box-shadow:9px 9px 0 0 var(--a);transform:translate(-3px,-3px)}
.dv-gcard .check{position:absolute;top:0;right:0;z-index:2;width:1.15rem;height:1.15rem;background:var(--a);
  border-left:3px solid #000;border-bottom:3px solid #000;display:flex;align-items:center;justify-content:center}
.dv-gcard .check::after{content:"";width:.42rem;height:.72rem;border:solid #0a0a0c;border-width:0 3px 3px 0;
  transform:translateY(-2px) rotate(45deg)}
`;

const view: DeckView = {
  id: "grid",
  label: "Grid",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  order: 10,
  css: CSS,
  render(ctx) {
    const scroll = h("div", "dv-gridscroll");
    const grid = h("div", "dv-grid"); // --card-w cascades from the stage (the live size dial)
    for (const e of ctx.entities) {
      const key = pieceKey(e);
      const isOpen = ctx.open.has(key);
      const staged = ctx.selected.has(key);
      const card = h("button", `dv-gcard${isOpen ? " cast" : ""}${staged ? " pick" : ""}`);
      card.style.setProperty("--a", e.accent ?? deckMeta(e.kind).accent);
      const cov = h("div", "cov");
      const art = ctx.portraitUrl(e);
      if (art) cov.style.backgroundImage = `url("${art}")`;
      else cov.append(h("b", undefined, e.name.charAt(0).toUpperCase()));
      cov.append(h("span", "kd", e.kind));
      const bd = h("div", "bd");
      bd.append(h("div", "nm", e.name));
      const fmt = ctx.sourceLabel(e);
      if (fmt) bd.append(h("span", "fmt", fmt));
      if (isOpen) card.append(h("span", "tick", "on the workbench"));
      if (staged) card.append(h("span", "check"));
      card.append(cov, bd);
      card.title = isOpen
        ? `${e.name} is open on the Workbench`
        : staged
          ? `${e.name} is staged - tap to unstage`
          : `Stage ${e.name} for the Workbench`;
      card.addEventListener("click", () => ctx.onPiece(e));
      ctx.menu(card, e);
      grid.append(card);
    }
    scroll.append(grid);
    return scroll;
  },
};

export default view;
