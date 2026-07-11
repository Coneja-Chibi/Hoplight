/**
 * Deck view: SHELF - lorebook spine cards (vs-lore-shelf). Enable switch, drag-merge target,
 * kebab via context menu. Non-lore decks still render as monogram spines.
 */
import { useState, type CSSProperties, type DragEvent, type JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";

const CSS = `
.dv-shelfscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.dv-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(12rem,100%),1fr));gap:.85rem;position:relative}
.dv-book{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out;
  --spine:var(--a)}
.dv-book:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--a)}
.dv-book .spine{position:absolute;left:0;top:0;bottom:0;width:.45rem;background:var(--spine);border-right:2px solid var(--stage-black)}
.dv-book .body{padding:.7rem .7rem .55rem 1.05rem;display:flex;flex-direction:column;gap:.3rem;min-height:6.2rem}
.dv-book .nm{font-family:var(--font-big);font-weight:800;font-size:.95rem;color:var(--stage-card);line-height:1.1}
.dv-book .meta{font-family:var(--font-mono);font-size:.52rem;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-kicker)}
.dv-book .foot{display:flex;align-items:center;gap:.4rem;padding:0 .55rem .55rem 1.05rem}
.dv-book .sw{width:1.7rem;height:.9rem;border:2px solid var(--stage-black);background:var(--stage-ok);position:relative;flex:none;cursor:pointer;padding:0}
.dv-book .sw::after{content:"";position:absolute;right:2px;top:1px;width:.45rem;height:.45rem;background:var(--stage-ink)}
.dv-book .sw.off{background:var(--stage-faint)}
.dv-book .sw.off::after{left:2px;right:auto}
.dv-book.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.78}
.dv-book.pick{outline:3px solid var(--a);outline-offset:-3px}
.dv-book.off .nm{text-decoration:line-through;color:var(--stage-mute)}
.dv-book.off{opacity:.55}
.dv-book.drop{outline:3px dashed var(--a);outline-offset:2px}
.dv-book .tick{position:absolute;top:0;right:0;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size:.5rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-left:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dv-book .dropTag{position:absolute;left:.5rem;right:.5rem;bottom:.4rem;font-family:var(--font-mono);font-size:.48rem;letter-spacing:.05em;text-transform:uppercase;color:var(--stage-ink);background:var(--a);border:2px solid var(--stage-black);padding:.2rem .3rem;text-align:center}
.dv-trash{position:sticky;bottom:.5rem;margin:0 auto;max-width:14rem;border:2px dashed var(--stage-danger-edge);color:var(--stage-danger-text);font-family:var(--font-mono);font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;padding:.55rem;text-align:center;background:var(--stage-danger-bg);opacity:0;pointer-events:none}
.dv-trash.show{opacity:1;pointer-events:auto}
`;

const DRAG_MIME = "application/x-vaude-lore-id";

function BookCard({
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
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const lore = ctx.loreShelf;
  const enabled = lore ? lore.enabledOf(e) : true;
  const count = lore?.entryCountOf(e);
  const [over, setOver] = useState(false);
  const menuRef = ctx.menus.useContextMenu(() => ({
    type: "entity",
    label: e.name,
    data: e,
  }));
  const accent = e.accent ?? deckMeta(e.kind).accent;

  const onDragStart = (ev: DragEvent): void => {
    if (e.kind !== "lorebook") return;
    ev.dataTransfer.setData(DRAG_MIME, e.id);
    ev.dataTransfer.effectAllowed = "copyMove";
    setDraggingId(e.id);
  };

  const onDragOver = (ev: DragEvent): void => {
    if (e.kind !== "lorebook" || !draggingId || draggingId === e.id) return;
    ev.preventDefault();
    setOver(true);
  };

  const onDrop = (ev: DragEvent): void => {
    ev.preventDefault();
    setOver(false);
    const fromId = ev.dataTransfer.getData(DRAG_MIME);
    if (!fromId || fromId === e.id || !lore) return;
    const from = ctx.entities.find((x) => x.id === fromId && x.kind === "lorebook");
    if (from) lore.onMerge(e, from);
    setDraggingId(null);
  };

  return (
    <div
      ref={menuRef}
      role="button"
      tabIndex={0}
      draggable={e.kind === "lorebook"}
      className={`dv-book${isOpen ? " cast" : ""}${staged ? " pick" : ""}${
        enabled ? "" : " off"
      }${over ? " drop" : ""}`}
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
      <span className="spine" aria-hidden="true" />
      <div className="body">
        <div className="nm">{e.name || "(unnamed)"}</div>
        <div className="meta">
          {typeof count === "number"
            ? `${count} ${count === 1 ? "entry" : "entries"}`
            : e.kind}
        </div>
      </div>
      {lore && e.kind === "lorebook" && (
        <div className="foot" onClick={(ev) => ev.stopPropagation()}>
          <button
            type="button"
            className={enabled ? "sw" : "sw off"}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Book is on" : "Book is off"}
            title="Off books skip export and Rehearsal listing"
            onClick={() => lore.onToggleEnabled(e, !enabled)}
          />
          <span className="meta">{enabled ? "On" : "Off"}</span>
          <button
            type="button"
            className="meta"
            style={{
              marginLeft: "auto",
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)",
            }}
            onClick={() => lore.onSplit(e)}
          >
            Split
          </button>
          <button
            type="button"
            className="meta"
            style={{
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)",
            }}
            onClick={() => lore.onDuplicate(e)}
          >
            Copy
          </button>
        </div>
      )}
      {isOpen && <span className="tick">open</span>}
      {over && <span className="dropTag">Drop to merge into {e.name}</span>}
    </div>
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
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? ctx.entities
      : ctx.entities.filter((e) => {
          if (e.name.toLowerCase().includes(q)) return true;
          // loreShelf may expose key search via entryCountOf presence only - use optional bag
          const keys = (e as StudioEntitySummary & { searchKeys?: string[] }).searchKeys;
          if (keys?.some((k) => k.toLowerCase().includes(q))) return true;
          return false;
        });
    return (
      <div className="dv-shelfscroll">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            border: "2px solid var(--stage-seam)",
            background: "var(--stage-sunken)",
            padding: "0.35rem 0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.55rem",
              color: "var(--stage-kicker)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Find
          </span>
          <input
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Name or key…"
            aria-label="Search lorebooks by name or key"
            style={{
              flex: 1,
              border: 0,
              background: "none",
              color: "var(--stage-soft)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
            }}
          />
        </label>
        <div className="dv-shelf">
          {filtered.map((e) => (
            <BookCard
              key={pieceKey(e)}
              ctx={ctx}
              e={e}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--stage-kicker)",
            }}
          >
            Nothing matches that search.
          </p>
        )}
        <div className={`dv-trash${draggingId ? " show" : ""}`}>
          Drag onto another book to merge
        </div>
      </div>
    );
  },
};

export default view;
