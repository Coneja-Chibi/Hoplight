/**
 * Deck view: LIST - dense rows for big collections: small art thumb, name, kind tag, workbench state.
 * The size pick scales the thumb.
 */
import { deckMeta } from "../../../_shared/decks";
import { h, pieceKey, type DeckView } from "../view-contract";

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
.dv-row.cast{border-color:var(--a);background:#0d0c11}
`;

const view: DeckView = {
  id: "list",
  label: "List",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  order: 30,
  css: CSS,
  render(ctx) {
    const scroll = h("div", "dv-listscroll");
    const list = h("div", "dv-list");
    for (const e of ctx.entities) {
      const onBench = ctx.threaded.has(pieceKey(e));
      const row = h("button", `dv-row${onBench ? " cast" : ""}`); // --card-w cascades from the stage
      row.style.setProperty("--a", e.accent ?? deckMeta(e.kind).accent);
      const thumb = h("span", "thumb");
      const art = ctx.portraitUrl(e);
      if (art) thumb.style.backgroundImage = `url("${art}")`;
      else thumb.textContent = e.name.charAt(0).toUpperCase();
      row.append(thumb, h("span", "nm", e.name), h("span", "kd", e.kind));
      const fmt = ctx.sourceLabel(e);
      if (fmt) row.append(h("span", "kd", fmt));
      if (onBench) row.append(h("span", "bench", "on the workbench"));
      row.title = onBench ? `${e.name} is open on the Workbench` : `Send ${e.name} to the Workbench`;
      row.addEventListener("click", () => ctx.onPiece(e));
      ctx.menu(row, e);
      list.append(row);
    }
    scroll.append(list);
    return scroll;
  },
};

export default view;
