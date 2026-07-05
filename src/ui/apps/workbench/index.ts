/**
 * The Workbench app - home: the IDE. Pieces sent from the Library open here; the shell's tab
 * strip IS the tab bar, and this room shows the ACTIVE piece's editor pane. Today's pane is a
 * truthful inspector (the piece's real art + real fields, read-only); the writable editor is the
 * next slice and replaces the pane's body, not the room. Empty = honest guidance.
 */
import type { AppContext, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";

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

/** Read the active piece's real words for the inspector pane (tolerant: absent fields just skip). */
async function inspect(ctx: AppContext, e: StudioEntitySummary): Promise<{ k: string; v: string }[]> {
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as {
      body?: { identity?: { tagline?: string }; persona?: { description?: string; personality?: string } };
    };
    const out: { k: string; v: string }[] = [];
    if (entity.body?.identity?.tagline) out.push({ k: "tagline", v: entity.body.identity.tagline });
    if (entity.body?.persona?.description) out.push({ k: "description", v: entity.body.persona.description });
    if (entity.body?.persona?.personality) out.push({ k: "personality", v: entity.body.persona.personality });
    return out;
  } catch {
    return [];
  }
}

function render(ctx: AppContext): void {
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
    const rerender = (): void => render(ctx);
    const unsub = ctx.workbench.onChange(rerender);
    rerender();
    return unsub;
  },
};

export default app;
