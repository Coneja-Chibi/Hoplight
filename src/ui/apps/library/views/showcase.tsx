/**
 * Deck view: SHOWCASE - one card at a time, properly. Hero art at full presence, the card's own
 * words beside it (tagline + description via peek), prev/next flipping, a thumb rail to jump, and
 * STAGE right there. A carousel's real job is looking closely at ONE card, so that is its job here
 * (not an aimless spinning shelf).
 */
import { useEffect, useReducer, useState } from "react";
import type { CSSProperties, JSX } from "react";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext, type PiecePeek } from "../view-contract";

const CSS = `
.dv-show{flex:1;min-height:0;display:flex;flex-direction:column}
.dv-show .sc-empty{margin:auto;font-family:var(--font-body);font-style:italic;color:var(--stage-kicker)}
.dv-show .main{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.7rem,2vw,1.4rem);
  padding:clamp(.8rem,2vw,1.4rem)}
.dv-show .nav{flex:none;width:2.4rem;height:2.4rem;display:flex;align-items:center;justify-content:center;
  background:var(--stage-panel);color:var(--stage-paper);border:3px solid var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);cursor:pointer;
  font-family:var(--font-big);font-weight:900;font-size:1rem;transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .nav:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 0 var(--stage-black)}
.dv-show .nav:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--stage-black)}
.dv-show .hero{flex:none;width:clamp(8rem,calc(var(--card-w) * 1.6),24rem);background:var(--stage-panel);border:3px solid var(--stage-black);
  box-shadow:0 24px 38px -14px var(--shadow-ink-deep)}
.dv-show .hero .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.5rem;background-size:cover;background-position:center top}
.dv-show .hero .cov b{font-family:var(--font-big);font-weight:900;font-size:3rem;line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-show .hero .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size:.5625rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
.dv-show .plate{flex:1;min-width:0;min-height:0;max-height:100%;overflow-y:auto;background:var(--stage-row);border:3px solid var(--stage-black);
  box-shadow:5px 6px 0 0 var(--shadow-ink);padding:clamp(.8rem,1.8vw,1.3rem);display:flex;flex-direction:column;gap:.6rem}
.dv-show .plate .nm{font-family:var(--font-big);font-weight:900;font-size:clamp(1.2rem,2.4vw,1.9rem);
  letter-spacing:-.01em;color:var(--stage-card);line-height:1;overflow-wrap:anywhere}
.dv-show .plate .tag{font-style:italic;font-weight:600;font-size:1rem;color:var(--stage-soft)}
.dv-show .plate .desc{font-size:.95rem;line-height:1.5;color:var(--stage-mute);white-space:pre-line}
.dv-show .plate .meta{font-family:var(--font-mono);font-size:.72rem;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--stage-soft)}
.dv-show .plate .stage-btn{align-self:flex-start;font-family:var(--font-big);font-weight:900;font-size:.625rem;
  letter-spacing:.1em;text-transform:uppercase;padding:.55rem .9rem;border:3px solid var(--stage-black);cursor:pointer;
  background:var(--a);color:var(--stage-ink);box-shadow:4px 4px 0 0 var(--stage-black);
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dv-show .plate .stage-btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--stage-black)}
.dv-show .plate .stage-btn:active{transform:translate(3px,3px);box-shadow:0 0 0 0 var(--stage-black)}
.dv-show .plate .stage-btn.off{background:var(--stage-panel);color:var(--stage-soft);border-color:var(--a)}
.dv-show .plate .stage-btn.open{background:transparent;color:var(--a);border-color:var(--a);cursor:default;box-shadow:none}
.dv-show .plate .stage-btn.open:hover{transform:none;box-shadow:none}
.dv-show .rail{flex:none;display:flex;gap:.4rem;padding:.5rem .8rem .8rem;overflow-x:auto}
.dv-show .mini{flex:none;width:2.2rem;aspect-ratio:2/3;border:2px solid var(--stage-black);background:var(--a);cursor:pointer;
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

/**
 * Clamp LAST to 0, not first: `Math.min(Math.max(raw, 0), len - 1)` returns -1 on an empty deck,
 * which indexes to undefined and crashed the whole view. An empty deck has no valid index at all,
 * so callers must check length first - this only guarantees the result is never negative.
 */
export function clampIndex(raw: number, len: number): number {
  return Math.max(0, Math.min(raw, len - 1));
}

/**
 * The deck can be empty while the studio is not: the Library's first-landing guard checks EVERY
 * entity, and each view is handed the ACTIVE deck's filter. One pack and the (default, persisted)
 * character deck = zero entities here. Both the view and the deck persist across reloads, so
 * without this branch the app white-screened on every launch until prefs were cleared.
 */
function Showcase({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  if (ctx.entities.length === 0) {
    return (
      <div className="dv-show">
        <p className="sc-empty">Nothing in the {ctx.deck.plural.toLowerCase()} deck yet.</p>
      </div>
    );
  }
  return <ShowcaseFocus ctx={ctx} />;
}

/** Assumes a non-empty deck - Showcase guards that above, so the hooks below can index safely. */
function ShowcaseFocus({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const idx = clampIndex(focusByKind.get(ctx.deck.kind) ?? 0, ctx.entities.length);
  const e = ctx.entities[idx]!;
  const accent = e.accent ?? deckMeta(e.kind).accent;
  const isOpen = ctx.open.has(pieceKey(e));
  const staged = ctx.selected.has(pieceKey(e));
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const [peek, setPeek] = useState<PiecePeek | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPeek(null);
    void ctx.peek(e).then((p) => {
      if (!cancelled) setPeek(p);
    });
    return () => {
      cancelled = true;
    };
    // re-peek whenever the focused piece changes
  }, [ctx, e]);

  const step = (delta: number): void => {
    const n = ctx.entities.length;
    focusByKind.set(ctx.deck.kind, (idx + delta + n) % n);
    bump();
  };

  const art = ctx.portraitUrl(e);
  const fmt = ctx.sourceLabel(e);
  const stageLabel = isOpen ? "On the Workbench" : staged ? "Staged - tap to unstage" : "Stage for the Workbench";

  return (
    <div className="dv-show" style={{ "--a": accent } as CSSProperties}>
      <div className="main">
        <button className="nav" title="Previous" onClick={() => step(-1)}>
          &lsaquo;
        </button>
        <div className="hero" ref={menuRef}>
          <div className="cov" style={art ? ({ backgroundImage: `url("${art}")` } as CSSProperties) : undefined}>
            {!art && <b>{e.name.charAt(0).toUpperCase()}</b>}
            <span className="kd">{e.kind}</span>
          </div>
        </div>
        <div className="plate">
          <div className="nm">{e.name}</div>
          {fmt && <div className="meta">{fmt}</div>}
          {e.provenance && <div className="meta">{e.provenance}</div>}
          {peek?.tagline && <div className="tag">{peek.tagline}</div>}
          {peek?.description && <div className="desc">{peek.description}</div>}
          <div className="meta">
            {idx + 1} / {ctx.entities.length}
          </div>
          <button className={`stage-btn${isOpen ? " open" : staged ? " off" : ""}`} onClick={() => ctx.onPiece(e)}>
            {stageLabel}
          </button>
        </div>
        <button className="nav" title="Next" onClick={() => step(1)}>
          &rsaquo;
        </button>
      </div>
      <div className="rail">
        {ctx.entities.map((m, i) => {
          const mart = ctx.portraitUrl(m);
          return (
            <button
              key={pieceKey(m)}
              className={`mini${i === idx ? " now" : ""}`}
              style={
                {
                  "--a": m.accent ?? deckMeta(m.kind).accent,
                  ...(mart ? { backgroundImage: `url("${mart}")` } : {}),
                } as CSSProperties
              }
              title={m.name}
              onClick={() => {
                focusByKind.set(ctx.deck.kind, i);
                bump();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const view: DeckView = {
  id: "showcase",
  label: "Show",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="3" width="10" height="15"/><path d="M3 8v8M21 8v8M9 21h6"/></svg>',
  order: 20,
  css: CSS,
  Component: Showcase,
};

export default view;
