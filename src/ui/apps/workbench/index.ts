/**
 * The Workbench app - home: where the PACK is woven. The browse room moved to the Library
 * (2026-07-05, Chi: "make what is currently the workbench into the library"); the bench keeps the
 * stage here. Today's truthful room: the threaded pack laid out large on the stage + the bench
 * string; pieces are pulled from the Library's shelves (tap a card there). The full weaving room
 * (JOURNEY 2.3) is still to be reviewed by Chi; nothing fake ships meanwhile.
 */
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";
import { packSummary } from "./bench-core";

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13"/><path d="M3 17h18"/><rect x="9" y="10" width="6" height="7" fill="currentColor" stroke="none"/></svg>';

const STYLE = `
.wbroom{flex:1;min-height:0;display:flex;flex-direction:column;padding:clamp(.7rem,1.8vw,1.1rem);gap:.7rem}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.wbstage{position:relative;flex:1;min-height:0;background:#0a0a0b;border:3px solid #000;overflow:hidden;
  box-shadow:inset 8px 8px 0 0 rgba(0,0,0,.7);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid #000;background:#0d0c11;padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid #000;background:var(--accent)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:#e7e3da}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:#6a6576;margin-left:auto}
.packfloor{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:clamp(.8rem,2vw,1.4rem);
  flex-wrap:wrap;overflow-y:auto;padding:clamp(.9rem,2vw,1.4rem)}
.pcard{width:clamp(7rem,14vw,10rem);background:#17161d;border:3px solid #000;cursor:pointer;text-align:left;font:inherit;padding:0;
  box-shadow:0 20px 30px -12px rgba(0,0,0,.78);transition:transform .15s ease-out}
.pcard:hover{transform:translateY(-6px)}
.pcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.pcard .cov b{font-family:var(--font-big);font-weight:900;font-size:2rem;line-height:.72;color:#0a0a0c;opacity:.82}
.pcard .cov .kd{position:absolute;top:0;left:0;background:#0a0a0c;color:var(--a);font-family:var(--font-mono);
  font-size:.44rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:2px 5px;border-right:3px solid #000;border-bottom:3px solid #000}
.pcard .bd{padding:.4rem .5rem .5rem}
.pcard .n{font-family:var(--font-big);font-weight:800;font-size:.8rem;color:#f4f1ee;line-height:1}
.ghost-bench{margin:auto;max-width:26rem;border:2px dashed #39353f;padding:1.4rem 1.6rem;text-align:center;
  font-family:var(--font-mono);font-size:.56rem;letter-spacing:.06em;line-height:1.7;text-transform:uppercase;color:#6a6576}
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
.wbroom *{scrollbar-width:thin;scrollbar-color:#2b2833 transparent}
.wbroom *::-webkit-scrollbar{width:8px;height:8px}
.wbroom *::-webkit-scrollbar-thumb{background:#2b2833}
.wbroom *::-webkit-scrollbar-track{background:transparent}
@media(max-width:40rem){
  .wbroom{padding:.5rem;gap:.5rem}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .pcard{width:clamp(6.5rem,40vw,9rem)}
}
`;

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

function render(ctx: AppContext): void {
  const pieces = ctx.bench.pieces();
  const room = h("div", "wbroom");
  const style = document.createElement("style");
  style.textContent = STYLE;
  room.append(style);

  // the stage: the pack-in-progress, laid out large
  const prosc = h("div", "prosc");
  const stage = h("div", "wbstage");
  const crumb = h("div", "stage-crumb");
  crumb.append(
    h("span", "pip"),
    h("span", "cn", "Untitled pack"),
    h("span", "cc", pieces.length ? packSummary(pieces) : "bench empty"),
  );
  stage.append(crumb);
  if (pieces.length === 0) {
    stage.append(
      h(
        "div",
        "ghost-bench",
        "the bench is empty · open the Library and tap a card to thread it here · your pack takes shape on this stage",
      ),
    );
  } else {
    const floor = h("div", "packfloor");
    for (const p of pieces) {
      const card = h("button", "pcard");
      card.style.setProperty("--a", p.accent ?? deckMeta(p.kind).accent);
      const cov = h("div", "cov");
      const art = portraitUrl(p);
      if (art) cov.style.backgroundImage = `url("${art}")`;
      else cov.append(h("b", undefined, p.name.charAt(0).toUpperCase()));
      cov.append(h("span", "kd", p.kind));
      const bd = h("div", "bd");
      bd.append(h("div", "n", p.name));
      card.append(cov, bd);
      card.title = `Pull ${p.name} off the bench`;
      card.addEventListener("click", () => ctx.bench.unthread(p.id, p.kind));
      floor.append(card);
    }
    stage.append(floor);
  }
  prosc.append(stage);

  // the bench string (same state, compact)
  const zone = h("div", "benchzone");
  const head = h("div", "bench-h");
  head.append(h("span", "bk", "threaded"), h("span", "bt", "Untitled pack"), h("span", "bn", packSummary(pieces)));
  zone.append(head);
  if (pieces.length > 0) {
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
  room.append(prosc, zone);
  ctx.root.replaceChildren(room);
  ctx.setStatus(pieces.length ? packSummary(pieces) : "the bench waits");
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
    const rerender = (): void => render(ctx);
    const unsub = ctx.bench.onChange(rerender);
    rerender();
    return unsub;
  },
};

export default app;
