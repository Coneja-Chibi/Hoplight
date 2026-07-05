/**
 * The Workbench app - home. Deck chips + drop-in DECK VIEWS (views/registry: grid/carousel/list,
 * user-sized art, both persisted via ctx.prefs) over the proscenium stage, with the bench string
 * below. Every number is real state; tap a piece to thread it, tap its bead to pull it off.
 * The workbench names no view: the toolbar derives from the registry (Chi's modularity policy).
 * All IO through ctx.api; pure logic in bench-core; view rendering in views/.
 */
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta, knownDecks } from "../../_shared/decks";
import { deckCounts, packSummary } from "./bench-core";
import { DECK_SIZES, h, pieceKey, type DeckViewContext } from "./view-contract";
import { deckView, deckViews } from "./views/registry";

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13"/><path d="M3 17h18"/><rect x="9" y="10" width="6" height="7" fill="currentColor" stroke="none"/></svg>';

const PREF_VIEW = "workbench.view";
const PREF_SIZE = "workbench.size";

/* Chrome css transcribed from the locked artifact; view css comes from each view module. */
const STYLE = `
.wbroom{flex:1;min-height:0;display:flex;flex-direction:column;padding:clamp(.7rem,1.8vw,1.1rem);gap:.7rem}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:400;font-size:.5625rem;color:var(--text-dim)}
.dchip:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.dchip.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--a)}
.dchip.on .dc{color:var(--stamp-fg);opacity:.7}
.viewseg{display:flex;flex:none;border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge)}
.viewseg button{border:none;border-left:3px solid var(--edge);background:var(--face);color:var(--text-dim);
  font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  padding:.4rem .6rem;cursor:pointer;display:flex;align-items:center;gap:.35rem}
.viewseg button:first-child{border-left:none}
.viewseg button.on{background:var(--stamp-bg);color:var(--stamp-fg)}
.viewseg svg{display:block}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.wbstage{position:relative;flex:1;min-height:0;background:#0a0a0b;border:3px solid #000;overflow:hidden;
  box-shadow:inset 8px 8px 0 0 rgba(0,0,0,.7);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid #000;background:#0d0c11;padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid #000;background:var(--a)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:#e7e3da}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:#6a6576;margin-left:auto}
.ghost-float{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed #39353f;
  display:flex;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size:.53rem;letter-spacing:.06em;line-height:1.5;
  text-transform:uppercase;color:#6a6576}
.benchzone{flex:none;border:3px solid var(--edge);background:var(--shell-panel);
  box-shadow:6px 6px 0 0 var(--edge);padding:.7rem clamp(.6rem,1.6vw,1rem)}
.bench-h{display:flex;align-items:baseline;gap:.6rem;margin-bottom:.5rem}
.bench-h .bk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.18em;text-transform:uppercase;color:var(--text-dim)}
.bench-h .bt{font-family:var(--font-big);font-weight:800;font-size:.6875rem;letter-spacing:.03em;text-transform:uppercase;color:var(--text)}
.bench-h .bn{margin-left:auto;font-family:var(--font-mono);font-size:.5625rem;color:var(--text-dim)}
.stringrow{display:flex;align-items:flex-start;flex-wrap:wrap;gap:0}
.bead{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:none;font:inherit;
  cursor:pointer;padding:0}
.bead .chip{width:2.5rem;height:2.5rem;border:3px solid var(--edge);background:var(--a);box-shadow:3px 3px 0 0 var(--edge);
  display:flex;align-items:center;justify-content:center;font-family:var(--font-big);font-weight:900;font-size:1rem;color:#0a0a0c;
  background-size:cover;background-position:center top}
.bead:hover .chip{opacity:.75}
.bead .lab{font-family:var(--font-mono);font-size:.53rem;text-transform:uppercase;letter-spacing:.03em;color:var(--text)}
.bead .dk{font-family:var(--font-mono);font-size:.47rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-dim)}
.knot{display:flex;align-items:center;margin-top:1.15rem}
.knot .thread{width:.9rem;height:3px;background:var(--edge)}
.knot .tie{width:9px;height:9px;background:var(--edge);transform:rotate(45deg)}
.bench-empty{font-family:var(--font-mono);font-size:.59rem;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-dim);border:2px dashed var(--text-faint);padding:.7rem .9rem;text-align:center}
`;

/** Parse a static first-party icon constant into a live SVG node (no innerHTML, house rule). */
const icon = (markup: string): Node =>
  document.importNode(new DOMParser().parseFromString(markup, "image/svg+xml").documentElement, true);

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

interface RoomState {
  entities: StudioEntitySummary[];
  activeKind: string;
}

function render(ctx: AppContext, state: RoomState): void {
  const views = deckViews();
  const view = deckView(ctx.prefs.get(PREF_VIEW));
  const size = DECK_SIZES.find((s) => s.id === ctx.prefs.get(PREF_SIZE)) ?? DECK_SIZES[1]!;

  const room = h("div", "wbroom");
  const style = document.createElement("style");
  style.textContent = STYLE + views.map((v) => v.css).join("\n");
  room.append(style);

  const decks = deckCounts(state.entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(state.activeKind);
  const inDeck = state.entities.filter((e) => e.kind === state.activeKind);
  const threaded = new Set(ctx.bench.pieces().map(pieceKey));

  // -- toolbar: deck chips (real counts) + the VIEW and SIZE controls (derived, never named) -------
  const bar = h("div", "wbbar");
  const chips = h("div", "deckchips");
  for (const { kind, count } of decks) {
    const meta = deckMeta(kind);
    const chip = h("button", `dchip${kind === state.activeKind ? " on" : ""}`);
    chip.style.setProperty("--a", meta.accent);
    chip.append(h("span", "pip"), document.createTextNode(meta.plural), h("span", "dc", String(count)));
    chip.addEventListener("click", () => render(ctx, { ...state, activeKind: kind }));
    chips.append(chip);
  }
  const viewSeg = h("div", "viewseg");
  for (const v of views) {
    const b = h("button", v.id === view.id ? "on" : undefined);
    b.append(icon(v.iconSvg), document.createTextNode(v.label));
    b.title = `${v.label} view`;
    b.addEventListener("click", () => {
      ctx.prefs.set(PREF_VIEW, v.id);
      render(ctx, state);
    });
    viewSeg.append(b);
  }
  const sizeSeg = h("div", "viewseg");
  for (const s of DECK_SIZES) {
    const b = h("button", s.id === size.id ? "on" : undefined, s.label);
    b.title = `${s.label} art`;
    b.addEventListener("click", () => {
      ctx.prefs.set(PREF_SIZE, s.id);
      render(ctx, state);
    });
    sizeSeg.append(b);
  }
  bar.append(chips, viewSeg, sizeSeg);

  // -- the stage: proscenium + the chosen view --------------------------------------------------------
  const prosc = h("div", "prosc");
  const stage = h("div", "wbstage");
  stage.style.setProperty("--a", deck.accent);
  const crumb = h("div", "stage-crumb");
  crumb.append(
    h("span", "pip"),
    h("span", "cn", deck.plural),
    h("span", "cc", inDeck.length ? `${view.label.toLowerCase()} · ${inDeck.length}` : "deck empty"),
  );
  stage.append(crumb);
  if (inDeck.length === 0) {
    stage.append(h("div", "ghost-float", `your first ${state.activeKind} lands here · import or start fresh in the library`));
  } else {
    const vctx: DeckViewContext = {
      entities: inDeck,
      deck,
      size,
      threaded,
      portraitUrl,
      onPiece: (e) => {
        if (threaded.has(pieceKey(e))) ctx.bench.unthread(e.id, e.kind);
        else ctx.bench.thread(e);
      },
    };
    stage.append(view.render(vctx));
  }
  prosc.append(stage);

  // -- the bench string (real threaded pack) ----------------------------------------------------------
  const zone = h("div", "benchzone");
  const head = h("div", "bench-h");
  const pieces = ctx.bench.pieces();
  head.append(h("span", "bk", "threaded"), h("span", "bt", "Untitled pack"), h("span", "bn", packSummary(pieces)));
  zone.append(head);
  if (pieces.length === 0) {
    zone.append(h("div", "bench-empty", "tap a card above to thread it onto the bench"));
  } else {
    const row = h("div", "stringrow");
    pieces.forEach((p, i) => {
      if (i > 0) {
        const knot = h("div", "knot");
        knot.append(h("span", "thread"), h("span", "tie"), h("span", "thread"));
        row.append(knot);
      }
      const bead = h("button", "bead");
      bead.style.setProperty("--a", p.accent ?? deckMeta(p.kind).accent);
      bead.title = `Pull ${p.name} off the bench`;
      const chip = h("div", "chip");
      const art = portraitUrl(p);
      if (art) chip.style.backgroundImage = `url("${art}")`;
      else chip.textContent = p.name.charAt(0).toUpperCase();
      bead.append(chip, h("div", "lab", p.name), h("div", "dk", deckMeta(p.kind).plural));
      bead.addEventListener("click", () => ctx.bench.unthread(p.id, p.kind));
      row.append(bead);
    });
    zone.append(row);
  }
  room.append(bar, prosc, zone);
  ctx.root.replaceChildren(room);
}

const app: VaudeApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "#e6a52a",
    order: 10,
    subtitle: "app · home",
  },
  mount(ctx) {
    let state: RoomState = { entities: [], activeKind: "character" };
    const rerender = (): void => render(ctx, state);
    const unsub = ctx.bench.onChange(rerender);
    void (async () => {
      state = { ...state, entities: await ctx.api.listEntities() };
      rerender();
    })();
    rerender(); // immediate paint (empty decks) while the shelves load
    return unsub;
  },
};

export default app;
