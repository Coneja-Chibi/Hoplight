/**
 * The Workbench app - home. The locked room (vs-shell-apps frame 1) transcribed: deck chips +
 * string/graph toggle, the proscenium stage with the FLOATED DECK, and the bench string below.
 * Every number is real state (deck counts, floated pieces, the threaded pack); presence rules:
 * tap a card to thread it (it dims in the deck, per the artifact's .cast), tap its bead to pull it
 * off. GRAPH view answers honestly until it is designed. All IO through ctx.api; logic in
 * bench-core (pure, tested).
 */
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta, knownDecks } from "../../_shared/decks";
import { deckCounts, floatPlan, packSummary } from "./bench-core";

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13"/><path d="M3 17h18"/><rect x="9" y="10" width="6" height="7" fill="currentColor" stroke="none"/></svg>';

/* Transcribed from the locked artifact (.wbroom family); colors swapped to tokens. */
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
.deckfloat{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.6rem,1.6vw,1.15rem);
  padding:clamp(.9rem,2vw,1.4rem) clamp(.7rem,1.8vw,1.2rem);overflow-x:auto;perspective:1400px}
.fcard{flex:none;width:clamp(5.5rem,11vw,7.5rem);background:#17161d;border:3px solid #000;cursor:pointer;
  text-align:left;font:inherit;padding:0;
  transform:rotateY(calc(var(--tilt,0) * 1deg)) translateY(calc(var(--rise,0) * 1px));
  box-shadow:0 20px 30px -12px rgba(0,0,0,.78);transition:transform .18s ease-out,box-shadow .18s ease-out}
.fcard:hover{transform:translateY(-8px) rotateY(0deg);box-shadow:0 30px 44px -14px rgba(0,0,0,.85)}
.fcard.cast{opacity:.26}
.fcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.fcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,5vw,2.4rem);line-height:.7;color:#0a0a0c;opacity:.82;letter-spacing:-.03em}
.fcard .cov .kd{position:absolute;top:0;left:0;background:#0a0a0c;color:var(--a);font-family:var(--font-mono);
  font-size:.44rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:2px 5px;border-right:3px solid #000;border-bottom:3px solid #000}
.fcard .bd{padding:.4rem .5rem .5rem}
.fcard .n{font-family:var(--font-big);font-weight:800;font-size:.75rem;color:#f4f1ee;line-height:1}
.fcard .s{font-style:italic;font-size:.75rem;color:#c9c4d2;margin-top:1px;line-height:1.15}
.ghost-float{flex:none;width:clamp(5.5rem,11vw,7.5rem);aspect-ratio:2/3;border:2px dashed #39353f;
  display:flex;align-items:center;justify-content:center;text-align:center;padding:.6rem;
  font-family:var(--font-mono);font-size:.53rem;letter-spacing:.06em;line-height:1.4;
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
  display:flex;align-items:center;justify-content:center;font-family:var(--font-big);font-weight:900;font-size:1rem;color:#0a0a0c}
.bead:hover .chip{background:var(--text-faint)}
.bead .lab{font-family:var(--font-mono);font-size:.53rem;text-transform:uppercase;letter-spacing:.03em;color:var(--text)}
.bead .dk{font-family:var(--font-mono);font-size:.47rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-dim)}
.knot{display:flex;align-items:center;margin-top:1.15rem}
.knot .thread{width:.9rem;height:3px;background:var(--edge)}
.knot .tie{width:9px;height:9px;background:var(--edge);transform:rotate(45deg)}
.bench-empty{font-family:var(--font-mono);font-size:.59rem;letter-spacing:.06em;text-transform:uppercase;
  color:var(--text-dim);border:2px dashed var(--text-faint);padding:.7rem .9rem;text-align:center}
`;

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const STRING_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2.4"/><circle cx="12" cy="12" r="2.4"/><circle cx="19" cy="12" r="2.4"/><path d="M7.4 12h2.2M14.4 12h2.2"/></svg>';
const GRAPH_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M11 8 7 16M13 8l4 8M8.4 18h7.2"/></svg>';

/** Parse a static first-party icon constant into a live SVG node (no innerHTML, house rule). */
const icon = (markup: string): Node =>
  document.importNode(new DOMParser().parseFromString(markup, "image/svg+xml").documentElement, true);

interface RoomState {
  entities: StudioEntitySummary[];
  activeKind: string;
}

function render(ctx: AppContext, state: RoomState): void {
  const room = h("div", "wbroom");
  const style = document.createElement("style");
  style.textContent = STYLE;
  room.append(style);

  const decks = deckCounts(state.entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(state.activeKind);
  const inDeck = state.entities.filter((e) => e.kind === state.activeKind);
  const threaded = new Set(ctx.bench.pieces().map((p) => `${p.kind}:${p.id}`));

  // -- toolbar: deck chips (real counts) + view toggle ---------------------------------------------
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
  const seg = h("div", "viewseg");
  const stringBtn = h("button", "on");
  stringBtn.append(icon(STRING_ICON), document.createTextNode("String"));
  const graphBtn = h("button");
  graphBtn.append(icon(GRAPH_ICON), document.createTextNode("Graph"));
  graphBtn.addEventListener("click", () => ctx.setStatus("the graph view is still being designed"));
  seg.append(stringBtn, graphBtn);
  bar.append(chips, seg);

  // -- the stage: proscenium + floated deck (real pieces) ------------------------------------------
  const prosc = h("div", "prosc");
  const stage = h("div", "wbstage");
  stage.style.setProperty("--a", deck.accent);
  const crumb = h("div", "stage-crumb");
  crumb.append(
    h("span", "pip"),
    h("span", "cn", deck.plural),
    h("span", "cc", inDeck.length ? `deck floated · ${inDeck.length}` : "deck empty"),
  );
  const float = h("div", "deckfloat");
  if (inDeck.length === 0) {
    float.append(h("div", "ghost-float", `your first ${state.activeKind} lands here · import or start fresh in the library`));
  } else {
    const plan = floatPlan(inDeck.length);
    inDeck.forEach((e, i) => {
      const card = h("button", `fcard${threaded.has(`${e.kind}:${e.id}`) ? " cast" : ""}`);
      card.style.setProperty("--a", e.accent ?? deck.accent);
      card.style.setProperty("--tilt", String(plan[i]!.tilt));
      card.style.setProperty("--rise", String(plan[i]!.rise));
      const cov = h("div", "cov");
      if (e.hasPortrait) {
        // real card art (the imported PNG's own pixels); the initial only stands in when art is absent
        cov.style.backgroundImage = `url("/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}")`;
      } else {
        cov.append(h("b", undefined, e.name.charAt(0).toUpperCase()));
      }
      cov.append(h("span", "kd", e.kind));
      const bd = h("div", "bd");
      bd.append(h("div", "n", e.name));
      if (e.provenance) bd.append(h("div", "s", e.provenance));
      card.append(cov, bd);
      card.title = threaded.has(`${e.kind}:${e.id}`) ? `${e.name} is on the bench` : `Thread ${e.name} onto the bench`;
      card.addEventListener("click", () => {
        const key = `${e.kind}:${e.id}`;
        if (threaded.has(key)) ctx.bench.unthread(e.id, e.kind);
        else ctx.bench.thread(e);
      });
      float.append(card);
    });
  }
  stage.append(crumb, float);
  prosc.append(stage);

  // -- the bench string (real threaded pack) --------------------------------------------------------
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
      const chip = h("div", "chip", p.name.charAt(0).toUpperCase());
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
