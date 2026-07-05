/**
 * Deck view: SHOWCASE - one card at a time, properly. Hero art at full presence, the card's own
 * words beside it (tagline + description via peek), prev/next flipping, a thumb rail to jump, and
 * STAGE right there. A carousel's real job is looking closely at ONE card, so that is its job here
 * (not an aimless spinning shelf).
 */
import { deckMeta } from "../../../_shared/decks";
import { h, pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.dv-show{flex:1;min-height:0;display:flex;flex-direction:column}
.dv-show .main{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.7rem,2vw,1.4rem);
  padding:clamp(.8rem,2vw,1.4rem)}
.dv-show .nav{flex:none;width:2.4rem;height:2.4rem;display:flex;align-items:center;justify-content:center;
  background:#17161d;color:#e7e3da;border:3px solid #000;box-shadow:3px 3px 0 0 #000;cursor:pointer;
  font-family:var(--font-big);font-weight:900;font-size:1rem;transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .nav:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 0 #000}
.dv-show .nav:active{transform:translate(3px,3px);box-shadow:0 0 0 0 #000}
.dv-show .hero{flex:none;width:clamp(8rem,calc(var(--card-w) * 1.6),24rem);background:#17161d;border:3px solid #000;
  box-shadow:0 24px 38px -14px rgba(0,0,0,.8)}
.dv-show .hero .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;position:relative;
  display:flex;align-items:flex-end;padding:.5rem;background-size:cover;background-position:center top}
.dv-show .hero .cov b{font-family:var(--font-big);font-weight:900;font-size:3rem;line-height:.72;color:#0a0a0c;opacity:.82}
.dv-show .hero .kd{position:absolute;top:0;left:0;background:#0a0a0c;color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid #000;border-bottom:3px solid #000}
.dv-show .plate{flex:1;min-width:0;min-height:0;max-height:100%;overflow-y:auto;background:#111015;border:3px solid #000;
  box-shadow:5px 6px 0 0 rgba(0,0,0,.55);padding:clamp(.8rem,1.8vw,1.3rem);display:flex;flex-direction:column;gap:.6rem}
.dv-show .plate .nm{font-family:var(--font-big);font-weight:900;font-size:clamp(1.2rem,2.4vw,1.9rem);
  letter-spacing:-.01em;color:#f4f1ee;line-height:1}
.dv-show .plate .tag{font-style:italic;font-weight:600;font-size:1rem;color:#c9c4d2}
.dv-show .plate .desc{font-size:.95rem;line-height:1.5;color:#a9a4b5;white-space:pre-line}
.dv-show .plate .meta{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;
  text-transform:uppercase;color:#6a6576}
.dv-show .plate .stage-btn{align-self:flex-start;font-family:var(--font-big);font-weight:900;font-size:.625rem;
  letter-spacing:.1em;text-transform:uppercase;padding:.55rem .9rem;border:3px solid #000;cursor:pointer;
  background:var(--a);color:#0a0a0c;box-shadow:4px 4px 0 0 #000;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .plate .stage-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 #000}
.dv-show .plate .stage-btn:active{transform:translate(3px,3px);box-shadow:0 0 0 0 #000}
.dv-show .plate .stage-btn.off{background:#17161d;color:#c9c4d2;border-color:var(--a)}
.dv-show .plate .stage-btn.open{background:transparent;color:var(--a);border-color:var(--a);cursor:default;box-shadow:none}
.dv-show .plate .stage-btn.open:hover{transform:none;box-shadow:none}
.dv-show .rail{flex:none;display:flex;gap:.4rem;padding:.5rem .8rem .8rem;overflow-x:auto}
.dv-show .mini{flex:none;width:2.2rem;aspect-ratio:2/3;border:2px solid #000;background:var(--a);cursor:pointer;
  background-size:cover;background-position:center top;opacity:.55;transition:opacity .1s ease-out,transform .1s ease-out}
.dv-show .mini:hover{opacity:1;transform:translateY(-2px)}
.dv-show .mini.now{opacity:1;border-color:var(--a);outline:2px solid var(--a)}
/* phones: hero row on top (nav flanking), the words plate drops below full-width (fluid law) */
@media(max-width:40rem){
  .dv-show .main{flex-wrap:wrap;overflow-y:auto;align-content:flex-start;gap:.6rem;padding:.6rem}
  .dv-show .hero{width:clamp(8rem,52vw,14rem)}
  .dv-show .plate{flex:1 1 100%;order:4;max-height:15rem}
}
`;

/** view-internal focus per deck kind; survives re-renders, resets on reload (ephemeral by design) */
const focusByKind = new Map<string, number>();

function focusedIndex(ctx: DeckViewContext): number {
  const raw = focusByKind.get(ctx.deck.kind) ?? 0;
  return Math.min(Math.max(raw, 0), ctx.entities.length - 1);
}

const view: DeckView = {
  id: "showcase",
  label: "Show",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="3" width="10" height="15"/><path d="M3 8v8M21 8v8M9 21h6"/></svg>',
  order: 20,
  css: CSS,
  render(ctx) {
    const idx = focusedIndex(ctx);
    const e = ctx.entities[idx]!;
    const accent = e.accent ?? deckMeta(e.kind).accent;
    const isOpen = ctx.open.has(pieceKey(e));
    const staged = ctx.selected.has(pieceKey(e));

    const root = h("div", "dv-show");
    root.style.setProperty("--a", accent);

    const step = (delta: number): void => {
      const n = ctx.entities.length;
      focusByKind.set(ctx.deck.kind, (idx + delta + n) % n);
      ctx.refresh();
    };

    const main = h("div", "main");
    const prev = h("button", "nav", "‹");
    prev.title = "Previous";
    prev.addEventListener("click", () => step(-1));
    const next = h("button", "nav", "›");
    next.title = "Next";
    next.addEventListener("click", () => step(1));

    const hero = h("div", "hero");
    const cov = h("div", "cov");
    const art = ctx.portraitUrl(e);
    if (art) cov.style.backgroundImage = `url("${art}")`;
    else cov.append(h("b", undefined, e.name.charAt(0).toUpperCase()));
    cov.append(h("span", "kd", e.kind));
    hero.append(cov);
    ctx.menu(hero, e);

    const plate = h("div", "plate");
    plate.append(h("div", "nm", e.name));
    const fmt = ctx.sourceLabel(e);
    if (fmt) plate.append(h("div", "meta", fmt));
    if (e.provenance) plate.append(h("div", "meta", e.provenance));
    const tag = h("div", "tag");
    const desc = h("div", "desc");
    plate.append(tag, desc);
    void ctx.peek(e).then((peek) => {
      if (peek?.tagline) tag.textContent = peek.tagline;
      else tag.remove();
      if (peek?.description) desc.textContent = peek.description;
      else desc.remove();
    });
    const stageLabel = isOpen ? "On the Workbench" : staged ? "Staged - tap to unstage" : "Stage for the Workbench";
    const stageBtn = h("button", `stage-btn${isOpen ? " open" : staged ? " off" : ""}`, stageLabel);
    stageBtn.addEventListener("click", () => ctx.onPiece(e));
    plate.append(h("div", "meta", `${idx + 1} / ${ctx.entities.length}`), stageBtn);

    main.append(prev, hero, plate, next);

    const rail = h("div", "rail");
    ctx.entities.forEach((m, i) => {
      const mini = h("button", `mini${i === idx ? " now" : ""}`);
      mini.style.setProperty("--a", m.accent ?? deckMeta(m.kind).accent);
      const mart = ctx.portraitUrl(m);
      if (mart) mini.style.backgroundImage = `url("${mart}")`;
      mini.title = m.name;
      mini.addEventListener("click", () => {
        focusByKind.set(ctx.deck.kind, i);
        ctx.refresh();
      });
      rail.append(mini);
    });

    root.append(main, rail);
    return root;
  },
};

export default view;
