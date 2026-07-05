/**
 * The Workbench app - home: the IDE. Pieces sent from the Library open here; the shell's tab
 * strip IS the tab bar, and this room shows the ACTIVE piece's editor pane. Today's pane is a
 * truthful inspector (the piece's real art + real fields, read-only); the writable editor is the
 * next slice and replaces the pane's body, not the room. Empty = honest guidance.
 */
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";
import { rankRecents } from "./recents-core";
import { fieldsFor, type InspectField } from "./inspect-core";

const RECENTS_SHOWN = 14; // how many "bring one up" cards the rail offers at most

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
.stage-crumb .pip{width:11px;height:11px;border:2px solid #000;background:var(--a,var(--accent))}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:#e7e3da}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.625rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8f8a9e;margin-left:auto}
.pane{flex:1;min-height:0;display:flex;gap:clamp(.8rem,2vw,1.4rem);padding:clamp(.8rem,2vw,1.4rem);overflow-y:auto}
.pane .art{flex:none;width:clamp(9rem,22vw,16rem);align-self:flex-start;background:var(--a);border:3px solid #000;
  aspect-ratio:2/3;background-size:cover;background-position:center top;
  box-shadow:0 24px 38px -14px rgba(0,0,0,.8);display:flex;align-items:flex-end;padding:.5rem}
.pane .art b{font-family:var(--font-big);font-weight:900;font-size:3rem;line-height:.72;color:#0a0a0c;opacity:.82}
.pane .sheet{flex:1;min-width:0;display:flex;flex-direction:column;gap:.7rem}
.pane .nm{font-family:var(--font-big);font-weight:900;font-size:clamp(1.3rem,2.6vw,2rem);letter-spacing:-.01em;color:#f4f1ee;line-height:1}
.pane .meta{font-family:var(--font-mono);font-size:.6875rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a6a1b4}
.pane .field{background:#111015;border:3px solid #000;padding:.6rem .8rem}
.pane .field .fk{font-family:var(--font-mono);font-size:.625rem;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:#8f8a9e;margin-bottom:.3rem}
.pane .field .fv{font-size:.95rem;line-height:1.55;color:#c9c4d2;white-space:pre-line}
.pane .soon{font-family:var(--font-mono);font-size:.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8f8a9e;
  border:2px dashed #4a4556;padding:.55rem .8rem}
.ghost-room{margin:auto;max-width:26rem;border:2px dashed #4a4556;padding:1.4rem 1.6rem;text-align:center;
  font-family:var(--font-mono);font-size:.6875rem;font-weight:700;letter-spacing:.06em;line-height:1.8;text-transform:uppercase;color:#8f8a9e}
/* the recents rail: a low deck of recently imported/opened pieces, offered as "bring one up" */
.wb-recents{flex:none;display:flex;flex-direction:column;gap:.4rem}
.wb-recents .rlabel{font-family:var(--font-mono);font-size:.5625rem;font-weight:700;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-dim);display:flex;align-items:center;gap:.45rem}
.wb-recents .rlabel .pip{width:8px;height:8px;background:var(--accent);border:2px solid var(--edge)}
.wb-strip{display:flex;gap:.5rem;overflow-x:auto;padding:.1rem 0 .35rem;scrollbar-width:thin}
.wb-rcard{flex:none;width:clamp(3rem,7vw,4.4rem);cursor:pointer;background:#17161d;border:3px solid #000;
  box-shadow:3px 3px 0 0 var(--a);padding:0;font:inherit;text-align:left;
  transition:transform .12s ease-out,box-shadow .12s ease-out}
.wb-rcard:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--a)}
.wb-rcard .rcov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;background-size:cover;
  background-position:center top;display:flex;align-items:flex-end;padding:.2rem}
.wb-rcard .rcov b{font-family:var(--font-big);font-weight:900;font-size:1.05rem;color:#0a0a0c;opacity:.82;line-height:.7}
.wb-rcard .rnm{font-family:var(--font-big);font-weight:800;font-size:.5625rem;color:#f4f1ee;padding:.22rem .3rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wbroom *{scrollbar-width:thin;scrollbar-color:#2b2833 transparent}
.wbroom *::-webkit-scrollbar{width:8px;height:8px}
.wbroom *::-webkit-scrollbar-thumb{background:#2b2833}
.wbroom *::-webkit-scrollbar-track{background:transparent}
@media(max-width:40rem){
  .wbroom{padding:.5rem;gap:.5rem}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .pane{flex-wrap:wrap}
  .pane .art{width:clamp(8rem,52vw,12rem)}
  .pane .sheet{flex:1 1 100%}
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

/** Read the active piece's real fields for the inspector pane. Tolerant: a fetch failure or an
 * unmodeled kind yields [] and the pane shows its honest "soon" note. All field selection/ordering
 * lives in inspect-core (pure + tested); this only fetches and hands off the body. */
async function inspect(ctx: AppContext, e: StudioEntitySummary): Promise<InspectField[]> {
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as { body?: unknown };
    return fieldsFor(e.kind, entity.body);
  } catch {
    return [];
  }
}

interface RoomState {
  entities: StudioEntitySummary[];
}

/** The low deck of recently imported/opened pieces - the "wanna bring this one up?" offer. Null
 * when nothing qualifies (empty studio, or everything recent is already an open tab). */
function recentsRail(ctx: AppContext, entities: StudioEntitySummary[]): HTMLElement | null {
  const openKeys = new Set(ctx.workbench.pieces().map((p) => `${p.kind}:${p.id}`));
  const recent = rankRecents(entities, ctx.workbench.recents(), openKeys, RECENTS_SHOWN);
  if (recent.length === 0) return null;

  const rail = h("div", "wb-recents");
  const label = h("div", "rlabel");
  label.append(h("span", "pip"), document.createTextNode("recent · bring one up"));
  const strip = h("div", "wb-strip");
  for (const e of recent) {
    const card = h("button", "wb-rcard");
    card.style.setProperty("--a", e.accent ?? deckMeta(e.kind).accent);
    const cov = h("div", "rcov");
    const url = portraitUrl(e);
    if (url) cov.style.backgroundImage = `url("${url}")`;
    else cov.append(h("b", undefined, e.name.charAt(0).toUpperCase()));
    card.append(cov, h("div", "rnm", e.name));
    card.title = `Bring ${e.name} up`;
    card.addEventListener("click", () => ctx.workbench.send(e));
    ctx.menus.attach(card, () => ({ type: "entity", label: e.name, data: e }));
    strip.append(card);
  }
  rail.append(label, strip);
  return rail;
}

function render(ctx: AppContext, state: RoomState): void {
  const pieces = ctx.workbench.pieces();
  const active = ctx.workbench.active();
  const room = h("div", "wbroom");
  const style = document.createElement("style");
  style.textContent = STYLE;
  room.append(style);

  const prosc = h("div", "prosc");
  const stage = h("div", "wbstage");
  const crumb = h("div", "stage-crumb");
  crumb.append(
    h("span", "pip"),
    h("span", "cn", active ? active.name : "The Workbench"),
    h("span", "cc", pieces.length === 0 ? "nothing open" : `${pieces.length} open`),
  );
  stage.append(crumb);

  if (!active) {
    stage.append(
      h(
        "div",
        "ghost-room",
        "nothing is open on the workbench · open the Library and send pieces here · each one opens as a tab above",
      ),
    );
  } else {
    if (active.accent) stage.style.setProperty("--a", active.accent);
    const pane = h("div", "pane");
    const art = h("div", "art");
    const url = portraitUrl(active);
    if (url) art.style.backgroundImage = `url("${url}")`;
    else art.append(h("b", undefined, active.name.charAt(0).toUpperCase()));
    ctx.menus.attach(art, () => ({ type: "entity", label: active.name, data: active }));

    const sheet = h("div", "sheet");
    sheet.append(h("div", "nm", active.name));
    const metaBits = [deckMeta(active.kind).plural];
    if (active.sourceFormat) {
      metaBits.push(active.sourceVariant ? `${active.sourceFormat} · ${active.sourceVariant}` : active.sourceFormat);
    }
    sheet.append(h("div", "meta", metaBits.join("  ·  ")));
    const fieldsHost = h("div", "sheet");
    fieldsHost.style.gap = ".7rem";
    sheet.append(fieldsHost);
    void inspect(ctx, active).then((fields) => {
      for (const f of fields) {
        const box = h("div", "field");
        box.append(h("div", "fk", f.k), h("div", "fv", f.v));
        fieldsHost.append(box);
      }
    });
    sheet.append(h("div", "soon", "read-only for now · full editing lands here next"));
    pane.append(art, sheet);
    stage.append(pane);
  }
  prosc.append(stage);
  room.append(prosc);
  const rail = recentsRail(ctx, state.entities);
  if (rail) room.append(rail);
  ctx.root.replaceChildren(room);
  ctx.setStatus(pieces.length === 0 ? "the workbench is clear" : `${pieces.length} open`);
}

const app: VaudeApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "#e6a52a",
    order: 10,
    subtitle: "app · home",
    editsPieces: true, // the shell's tab strip focuses into this room
  },
  mount(ctx) {
    const state: RoomState = { entities: [] };
    const rerender = (): void => render(ctx, state);
    const unsub = ctx.workbench.onChange(rerender);
    void ctx.api.listEntities().then((list) => {
      state.entities = list;
      rerender();
    });
    rerender(); // immediate paint (rail fills in when the shelves load)
    return unsub;
  },
};

export default app;
