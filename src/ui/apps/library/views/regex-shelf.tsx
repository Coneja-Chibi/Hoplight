/**
 * Deck view: REGEX SHELF (vs-regex-shelf-gallery wire 1) - regex sets as spine-stripe cards.
 * Teal-by-default spine (the deck accent, per entity), computed one-line "does what", rule count
 * with on-count, a slow-rule chip placeholder (Health wires it in R4), a set-level enable switch,
 * inline Split / Copy, and drag-onto-another-set to merge. Kind-scoped to the regex deck.
 *
 * Interaction is transcribed from the shipped lorebook shelf (views/shelf.tsx): the actions are
 * inline foot buttons + drag-merge + the shell's right-click entity menu, NOT the wireframe's
 * decorative kebab. Rename / Delete / a merge-target picker are not shipped on the lore shelf
 * either, so they are deferred here too (see the executor report's deviations).
 */
import { useState, type CSSProperties, type DragEvent, type JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.rgx-scroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.rgx-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(16rem,100%),1fr));gap:1.15rem;position:relative}
.rgx-set{--spine:var(--a);position:relative;display:flex;flex-direction:column;min-height:11rem;padding:0 0 0 .75rem;text-align:left;font:inherit;color:inherit;cursor:pointer;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);transition:transform .12s ease-out,box-shadow .12s ease-out}
.rgx-set::before{content:"";position:absolute;left:0;top:0;bottom:0;width:.75rem;background:var(--spine);border-right:3px solid var(--stage-black)}
.rgx-set:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--stage-black)}
.rgx-set.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.8}
.rgx-set.pick{outline:3px solid var(--a);outline-offset:-3px}
.rgx-set.off{opacity:.55}
.rgx-set.off .rgx-nm{text-decoration:line-through;color:var(--stage-mute)}
.rgx-set.drop{outline:3px dashed var(--a);outline-offset:2px}
.rgx-head{display:flex;align-items:flex-start;gap:.6rem;padding:.75rem .7rem .45rem}
.rgx-mark{width:2.3rem;height:2.3rem;flex:none;display:grid;place-items:center;font:900 .95rem var(--font-mono);
  background:var(--spine);color:var(--stage-ink);border:3px solid var(--stage-black);box-shadow:2px 2px 0 0 var(--stage-black)}
.rgx-name{min-width:0}
.rgx-nm{display:block;font:900 1rem/1.1 var(--font-big);letter-spacing:.02em;text-transform:uppercase;color:var(--stage-card);overflow-wrap:anywhere}
.rgx-sub{font:500 .625rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-text-dim)}
.rgx-does{flex:1;padding:0 .7rem;font:italic 600 .82rem/1.4 var(--font-body);color:var(--stage-mute);overflow-wrap:anywhere}
.rgx-foot{display:flex;align-items:flex-end;gap:.5rem;padding:.5rem .7rem .7rem;border-top:2px solid var(--stage-seam)}
.rgx-count b{display:block;font:900 1.5rem/1 var(--font-big);color:var(--stage-card)}
.rgx-count span{font:500 .625rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;color:var(--stage-text-dim)}
.rgx-slow{align-self:center;font:700 .625rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--stage-warn);color:var(--stage-warn);padding:.1rem .3rem}
.rgx-sw{width:2rem;height:1.05rem;flex:none;margin-left:auto;align-self:center;padding:0;cursor:pointer;position:relative;background:var(--stage-ok);border:2px solid var(--stage-black)}
.rgx-sw::after{content:"";position:absolute;right:2px;top:1px;width:.58rem;height:.58rem;background:var(--stage-ink)}
.rgx-sw.off{background:var(--stage-faint)}
.rgx-sw.off::after{left:2px;right:auto}
.rgx-act{align-self:center;cursor:pointer;font:700 .625rem var(--font-mono);letter-spacing:.05em;text-transform:uppercase;padding:.22rem .4rem;
  color:var(--stage-soft);background:var(--stage-row);border:1px solid var(--stage-seam)}
.rgx-new{display:grid;place-items:center;min-height:11rem;cursor:pointer;font:700 .625rem var(--font-mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--stage-mute);background:none;border:2px dashed var(--stage-seam)}
.rgx-empty{font-family:var(--font-body);font-style:italic;color:var(--stage-kicker)}
.rgx-trash{position:sticky;bottom:.5rem;margin:.6rem auto 0;max-width:16rem;text-align:center;opacity:0;pointer-events:none;
  font:500 .625rem var(--font-mono);letter-spacing:.08em;text-transform:uppercase;padding:.55rem;
  color:var(--stage-danger-text);background:var(--stage-danger-bg);border:2px dashed var(--stage-danger-edge)}
.rgx-trash.show{opacity:1;pointer-events:auto}
`;

const DRAG_MIME = "application/x-vaude-regex-id";

const markOf = (name: string): string =>
  (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase() || ".*";

function SetCard({
  ctx,
  e,
  draggingId,
  setDraggingId,
}: {
  ctx: DeckViewContext;
  e: StudioEntitySummary;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}): JSX.Element {
  const rgx = ctx.regexShelf;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const enabled = rgx ? rgx.enabledOf(e) : true;
  const count = rgx?.ruleCountOf(e);
  const onCount = rgx?.enabledRuleCountOf(e);
  const does = rgx?.doesWhatOf(e);
  const slow = rgx?.slowCountOf(e) ?? 0;
  const [over, setOver] = useState(false);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const accent = e.accent ?? deckMeta(e.kind).accent;

  const onDragStart = (ev: DragEvent): void => {
    ev.dataTransfer.setData(DRAG_MIME, e.id);
    ev.dataTransfer.effectAllowed = "copyMove";
    setDraggingId(e.id);
  };
  const onDragOver = (ev: DragEvent): void => {
    if (!draggingId || draggingId === e.id) return;
    ev.preventDefault();
    setOver(true);
  };
  const onDrop = (ev: DragEvent): void => {
    ev.preventDefault();
    setOver(false);
    const fromId = ev.dataTransfer.getData(DRAG_MIME);
    if (!fromId || fromId === e.id || !rgx) return;
    const from = ctx.entities.find((x) => x.id === fromId && x.kind === "regex");
    if (from) rgx.onMerge(e, from);
    setDraggingId(null);
  };

  return (
    <div
      ref={menuRef}
      role="button"
      tabIndex={0}
      draggable
      className={`rgx-set${isOpen ? " cast" : ""}${staged ? " pick" : ""}${enabled ? "" : " off"}${
        over ? " drop" : ""
      }`}
      style={{ "--a": accent, "--spine": accent } as CSSProperties}
      title={isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`}
      onClick={() => ctx.onPiece(e)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.onPiece(e);
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={() => setDraggingId(null)}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="rgx-head">
        <span className="rgx-mark" aria-hidden="true">
          {markOf(e.name || "?")}
        </span>
        <div className="rgx-name">
          <span className="rgx-nm">{e.name || "(unnamed)"}</span>
          <span className="rgx-sub">{ctx.sourceLabel(e) ?? "regex set"}</span>
        </div>
      </div>
      <p className="rgx-does">{does ?? "…"}</p>
      <div className="rgx-foot" onClick={(ev) => ev.stopPropagation()}>
        <div className="rgx-count">
          <b>{typeof count === "number" ? count : "·"}</b>
          <span>
            {count === 1 ? "rule" : "rules"}
            {typeof onCount === "number" && typeof count === "number" && count > 0
              ? ` · ${onCount} on`
              : ""}
          </span>
        </div>
        {slow > 0 && <span className="rgx-slow">{`${slow} slow`}</span>}
        {rgx && (
          <>
            <button
              type="button"
              className={enabled ? "rgx-sw" : "rgx-sw off"}
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? "Set is on" : "Set is off"}
              title="Off sets skip export"
              onClick={() => rgx.onToggleEnabled(e, !enabled)}
            />
            <button type="button" className="rgx-act" onClick={() => rgx.onSplit(e)}>
              Split
            </button>
            <button type="button" className="rgx-act" onClick={() => rgx.onDuplicate(e)}>
              Copy
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const view: DeckView = {
  id: "regex-shelf",
  label: "Sets",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><path d="M4 19h16"/><path d="M6 19V7l4 2 4-2 4 2v10"/><path d="M10 9v10"/><path d="M14 9v10"/></svg>',
  order: 16,
  kinds: ["regex"],
  css: CSS,
  Component({ ctx }) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const rgx = ctx.regexShelf;
    return (
      <div className="rgx-scroll">
        <div className="rgx-shelf">
          {ctx.entities.map((e) => (
            <SetCard
              key={pieceKey(e)}
              ctx={ctx}
              e={e}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          ))}
          {rgx && (
            <button type="button" className="rgx-new" onClick={() => rgx.onNew()}>
              + New set · or drop a file
            </button>
          )}
        </div>
        {ctx.entities.length === 0 && <p className="rgx-empty">No regex sets yet.</p>}
        <div className={`rgx-trash${draggingId ? " show" : ""}`}>
          Drag onto another set to merge
        </div>
      </div>
    );
  },
};

export default view;
