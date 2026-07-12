/**
 * Deck view: PERSONA SHELF (design/vs-persona-editor.html wire 2) - persona cards: portrait (or
 * monogram) cover with the gilt Default badge, name, the BRIEF as the card line (its one honest
 * home), and the pronouns · sections · lorebook fact line. Kind-scoped to the persona deck; taps
 * stage/note via ctx.onPiece like every deck view, and the shell entity menu does the sending.
 */
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.psh-scroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.psh-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr));gap:1.1rem}
.psh-card{position:relative;display:flex;flex-direction:column;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:0;
  background:var(--stage-panel);border:2px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);transition:transform .12s ease-out,box-shadow .12s ease-out}
.psh-card:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--stage-black)}
.psh-card.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.85}
.psh-card.pick{outline:3px solid var(--a);outline-offset:-3px}
.psh-cov{height:7.5rem;background:var(--stage-sunken);background-size:cover;background-position:center;display:grid;place-items:center;
  color:var(--stage-kicker);font:900 1.6rem var(--font-big);border-bottom:2px solid var(--stage-black);position:relative}
.psh-def{position:absolute;top:.4rem;right:.4rem;font:700 .48rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--stage-warn-ink);color:var(--stage-warn);border:1px solid var(--stage-black);padding:.08rem .3rem}
.psh-body{padding:.5rem .6rem}
.psh-nm{display:block;font:800 .8rem var(--font-big);letter-spacing:.03em;text-transform:uppercase;color:var(--stage-card);overflow-wrap:anywhere}
.psh-brief{font-style:italic;font-family:var(--font-body);color:var(--stage-mute);font-size:.78rem;overflow-wrap:anywhere}
.psh-line{font:500 .58rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-kicker);margin-top:.3rem}
.psh-new{display:grid;place-items:center;min-height:12rem;cursor:pointer;font:700 .62rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--stage-mute);background:none;border:2px dashed var(--stage-seam)}
`;

const ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';

function PersonaCard({ ctx, e }: { ctx: DeckViewContext; e: StudioEntitySummary }): JSX.Element {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const ps = ctx.personaShelf;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const url = ctx.portraitUrl(e);
  const sectionCount = ps?.sectionCountOf(e);
  const facts = [
    ps?.pronounsOf(e),
    sectionCount ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}` : undefined,
    ps?.hasLorebookOf(e) ? "lorebook linked" : undefined,
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      role="button"
      tabIndex={0}
      className={`psh-card${isOpen ? " cast" : ""}${staged ? " pick" : ""}`}
      style={{ "--a": e.accent ?? deckMeta(e.kind).accent } as CSSProperties}
      title={isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`}
      onClick={() => ctx.onPiece(e)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.onPiece(e);
        }
      }}
    >
      <div className="psh-cov" style={url ? { backgroundImage: `url("${url}")` } : undefined}>
        {!url && <span>{e.name.charAt(0).toUpperCase()}</span>}
        {ps?.defaultId === e.id && <span className="psh-def">Default</span>}
      </div>
      <div className="psh-body">
        <b className="psh-nm">{e.name}</b>
        <i className="psh-brief">{ps?.briefOf(e) ?? "No blurb yet."}</i>
        {facts.length > 0 && <div className="psh-line">{facts.join(" · ")}</div>}
      </div>
    </div>
  );
}

function PersonaShelfView(ctx: DeckViewContext): JSX.Element {
  const personas = ctx.entities.filter((e) => e.kind === "persona");
  return (
    <div className="psh-scroll">
      <div className="psh-shelf">
        {personas.map((e) => (
          <PersonaCard key={e.id} ctx={ctx} e={e} />
        ))}
        {ctx.personaShelf && (
          <button type="button" className="psh-new" onClick={() => ctx.personaShelf!.onNew()}>
            + New persona
          </button>
        )}
      </div>
    </div>
  );
}

const view: DeckView = {
  id: "persona-shelf",
  label: "Shelf",
  iconSvg: ICON,
  order: 15,
  css: CSS,
  kinds: ["persona"],
  Component({ ctx }) {
    return <PersonaShelfView {...ctx} />;
  },
};

export default view;
