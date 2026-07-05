/**
 * The Library app - the shelves, Vaude's deep-browse room (re-homed from the workbench 2026-07-05:
 * browsing IS the Library). Empty studio = the LOCKED first-run doors (vs-firstrun frame 1);
 * populated = the browse room: deck chips with live counts, drop-in DECK VIEWS (views/registry:
 * grid/showcase/list), the continuous art-size dial, all persisted via ctx.prefs. Opens on the
 * deck chosen at setup (JOURNEY rule). Import (drop anywhere, plain-words receipts) lives here.
 * Tapping a piece threads it onto the shell-owned bench; the Workbench is where the pack is woven.
 */
import type { AppContext, InspectResult, StudioEntitySummary, VaudeApp } from "../../app-contract";
import { deckMeta, knownDecks } from "../../_shared/decks";
import { deckCounts } from "./deck-core";
import { clampSize, h, pieceKey, SIZE_RANGE, type DeckViewContext, type PiecePeek } from "./view-contract";
import { deckView, deckViews } from "./views/registry";

/** the locked shelf-of-books mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><rect x="5" y="8" width="3" height="12"/><rect x="9.5" y="5" width="3" height="15"/><path d="M15 20V9l3-1 1.6 10.8-3.4.6z"/></svg>';

const PREF_VIEW = "library.view";
const PREF_SIZE = "library.size";
const PREF_FIRST_DECK = "firstDeck"; // written by the setup wizard; the shelves open on it

const STYLE = `
.chipbtn{font-family:var(--font-big);font-weight:900;font-size:.7rem;letter-spacing:.07em;
  text-transform:uppercase;background:var(--panel);color:var(--ink);cursor:pointer;padding:.45rem .8rem}
.chipbtn.primary{background:var(--rose);color:#fff}
.lib{display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.doorcard{aspect-ratio:2/3;width:clamp(11rem,22vw,16rem);display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--gap-m);background:var(--panel);color:var(--ink);cursor:pointer;padding:var(--gap-m);text-align:center;
  font-family:var(--font-big);font-weight:900;font-size:clamp(1rem,1.6vw,1.3rem);line-height:1.15}
.doorcard.primary{background:var(--rose);color:#fff}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:var(--gap-l);z-index:50}
.sheet{background:var(--paper);color:var(--ink);border:var(--ink-border);box-shadow:8px 8px 0 0 var(--ink);
  max-width:38rem;width:100%;max-height:85dvh;overflow:auto;padding:var(--gap-l);display:flex;flex-direction:column;gap:var(--gap-m)}
.receipt{border:var(--ink-border);background:var(--panel);padding:var(--gap-m)}
.receipt h3{margin:0 0 .2rem;font-family:var(--font-big);font-size:1.1rem}
.receipt p{margin:.15rem 0;font-size:1rem}
.receipt.bad{border-style:dashed;color:var(--muted)}
.mono{font-family:var(--font-mono);font-size:.7rem;color:var(--muted)}
.sheet .actions{display:flex;gap:var(--gap-s);flex-wrap:wrap}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:600;font-size:.5625rem;color:var(--text-dim)}
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
.sizedial{display:flex;align-items:center;gap:.45rem;flex:none;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .6rem}
.sizedial .sk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.sizedial input{appearance:none;-webkit-appearance:none;width:clamp(5rem,9vw,8rem);height:3px;background:var(--text-faint);
  outline:none;cursor:pointer}
.sizedial input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;
  background:var(--text);border:2px solid var(--edge)}
.sizedial input::-moz-range-thumb{width:12px;height:12px;background:var(--text);border:2px solid var(--edge);border-radius:0}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.libstage{position:relative;flex:1;min-height:0;background:#0a0a0b;border:3px solid #000;overflow:hidden;
  box-shadow:inset 8px 8px 0 0 rgba(0,0,0,.7);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid #000;background:#0d0c11;padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid #000;background:var(--a)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:#e7e3da}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:#8f8a9e;margin-left:auto}
.ghost-shelf{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed #39353f;
  display:flex;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size:.625rem;letter-spacing:.06em;line-height:1.5;
  text-transform:uppercase;color:#6a6576}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:#2b2833 transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:#2b2833}
.lib *::-webkit-scrollbar-track{background:transparent}
.deckchips{scrollbar-width:none}
.deckchips::-webkit-scrollbar{display:none}
/* phones: chips WRAP (everything visible, nothing hidden behind an invisible scroll), the view
   seg gets its row, the dial gets a full row so the thumb never clips (fluid law) */
@media(max-width:40rem){
  .lib{padding:.5rem;gap:.5rem}
  .wbbar{gap:.4rem}
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .doorcard{width:clamp(9rem,42vw,12rem)}
}
`;

// -- import flow (unchanged: plain-words receipts, never blocks good files on a bad one) ------------

interface ReadFile {
  filename: string;
  result: InspectResult;
}

function receiptCard(r: ReadFile): HTMLElement {
  const box = h("div", `receipt${r.result.ok ? "" : " bad"}`);
  if (r.result.ok && r.result.receipt) {
    box.append(h("h3", undefined, r.result.receipt.name));
    box.append(h("p", undefined, r.result.receipt.kindLine));
    for (const line of r.result.receipt.extras) box.append(h("p", undefined, line));
    box.append(h("div", "mono", "see everything we read"));
  } else {
    box.append(h("h3", undefined, r.filename));
    box.append(h("p", undefined, r.result.error ?? "We could not read this one."));
  }
  return box;
}

async function importFlow(ctx: AppContext, files: File[], onDone: () => void): Promise<void> {
  const overlay = h("div", "overlay");
  const sheet = h("div", "sheet");
  overlay.append(sheet);
  sheet.append(h("h2", undefined, "Reading your files"));
  document.body.append(overlay);

  const read: ReadFile[] = [];
  for (const file of files) {
    read.push({ filename: file.name, result: await ctx.api.inspectFile(file) });
  }
  sheet.replaceChildren();
  const good = read.filter((r) => r.result.ok);
  sheet.append(h("h2", undefined, good.length === read.length ? "All read." : "Here is what we read."));
  for (const r of read) sheet.append(receiptCard(r));

  const actions = h("div", "actions");
  const put = h("button", "chipbtn primary stamp", `Put ${good.length} on the shelf`);
  const cancel = h("button", "chipbtn stamp", "Not now");
  if (good.length === 0) put.setAttribute("disabled", "true");
  put.addEventListener("click", async () => {
    for (const r of good) await ctx.api.saveEntity(r.result.entity);
    overlay.remove();
    onDone();
  });
  cancel.addEventListener("click", () => overlay.remove()); // atomic: nothing written unless shelved
  actions.append(put, cancel);
  sheet.append(actions);
}

function pickFiles(onFiles: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", () => onFiles([...(input.files ?? [])]));
  input.click();
}

// -- the browse room --------------------------------------------------------------------------------

const portraitUrl = (e: StudioEntitySummary): string | null =>
  e.hasPortrait ? `/api/studio/portrait?kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}` : null;

/** Fetch a piece's own words for close-up views; tolerant (null on any failure). */
async function peekPiece(ctx: AppContext, e: StudioEntitySummary): Promise<PiecePeek | null> {
  try {
    const entity = (await ctx.api.getEntity(
      `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
    )) as { body?: { identity?: { tagline?: string }; persona?: { description?: string } } };
    const tagline = entity.body?.identity?.tagline;
    const description = entity.body?.persona?.description;
    if (!tagline && !description) return null;
    return { tagline, description };
  } catch {
    return null;
  }
}

interface RoomState {
  entities: StudioEntitySummary[];
  activeKind: string;
  /** format id -> chip label ("RoleCall", "Default"), from the live registry (no magic maps) */
  formatLabels: Map<string, string>;
}

/** "RoleCall · V3" / "Default · V2" from the summary's source fields; null = made from scratch. */
function sourceLabel(state: RoomState, e: StudioEntitySummary): string | null {
  if (!e.sourceFormat) return null;
  const base = state.formatLabels.get(e.sourceFormat) ?? e.sourceFormat;
  return e.sourceVariant ? `${base} · ${e.sourceVariant.toUpperCase()}` : base;
}

function render(ctx: AppContext, state: RoomState): void {
  const root = h("div", "lib");
  const style = document.createElement("style");
  const views = deckViews();
  style.textContent = STYLE + views.map((v) => v.css).join("\n");
  root.append(style);

  if (state.entities.length === 0) {
    // FIRST LANDING (locked): two massive door-cards, verbatim copy, nothing else competing.
    const stage = h("div", "stagezone seam");
    const importDoor = h("button", "doorcard primary stamp", "Drag and drop to import asset");
    const freshDoor = h("button", "doorcard stamp", "Click here to start fresh");
    importDoor.addEventListener("click", () => pickFiles((files) => void importFlow(ctx, files, () => reload(ctx, state))));
    freshDoor.addEventListener("click", () => ctx.setStatus("the editor arrives next slice"));
    stage.append(importDoor, freshDoor);
    root.append(stage, h("p", "voice", "Every pack starts with a first card."));
    ctx.setStatus("empty studio");
  } else {
    renderBrowse(ctx, state, root);
  }

  // drop works everywhere from minute one
  root.addEventListener("dragover", (e) => e.preventDefault());
  root.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) void importFlow(ctx, files, () => reload(ctx, state));
  });

  ctx.root.replaceChildren(root);
}

function renderBrowse(ctx: AppContext, state: RoomState, root: HTMLElement): void {
  const view = deckView(ctx.prefs.get(PREF_VIEW));
  const sizeRem = clampSize(ctx.prefs.get(PREF_SIZE));
  root.style.setProperty("--card-w", `${sizeRem}rem`); // the size dial's var; views build from it

  const decks = deckCounts(state.entities, knownDecks().map((d) => d.kind));
  const deck = deckMeta(state.activeKind);
  const inDeck = state.entities.filter((e) => e.kind === state.activeKind);
  const threaded = new Set(ctx.workbench.pieces().map(pieceKey));

  // toolbar: deck chips (real counts) + the VIEW picker and SIZE dial (derived, never named)
  const bar = h("div", "wbbar");
  const chips = h("div", "deckchips");
  for (const { kind, count } of decks) {
    const meta = deckMeta(kind);
    const chip = h("button", `dchip${kind === state.activeKind ? " on" : ""}`);
    chip.style.setProperty("--a", meta.accent);
    chip.append(h("span", "pip"), document.createTextNode(meta.plural), h("span", "dc", String(count)));
    chip.addEventListener("click", () => {
      state.activeKind = kind; // mutate the shared room state so workbench-driven rerenders stay in sync
      render(ctx, state);
    });
    chips.append(chip);
  }
  const viewSeg = h("div", "viewseg");
  for (const v of deckViews()) {
    const b = h("button", v.id === view.id ? "on" : undefined);
    b.append(icon(v.iconSvg), document.createTextNode(v.label));
    b.title = `${v.label} view`;
    b.addEventListener("click", () => {
      ctx.prefs.set(PREF_VIEW, v.id);
      render(ctx, state);
    });
    viewSeg.append(b);
  }
  const dial = h("label", "sizedial");
  dial.append(h("span", "sk", "art"));
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(SIZE_RANGE.min);
  slider.max = String(SIZE_RANGE.max);
  slider.step = "0.5";
  slider.value = String(sizeRem);
  slider.title = "Art size";
  slider.addEventListener("input", () => {
    root.style.setProperty("--card-w", `${clampSize(Number(slider.value))}rem`); // live, no re-render
  });
  slider.addEventListener("change", () => {
    ctx.prefs.set(PREF_SIZE, clampSize(Number(slider.value)));
    render(ctx, state);
  });
  dial.append(slider);
  bar.append(chips, viewSeg, dial);

  // the shelves' stage: proscenium + the chosen view
  const prosc = h("div", "prosc");
  const stage = h("div", "libstage");
  stage.style.setProperty("--a", deck.accent);
  const crumb = h("div", "stage-crumb");
  crumb.append(
    h("span", "pip"),
    h("span", "cn", deck.plural),
    h("span", "cc", inDeck.length ? `${view.label.toLowerCase()} · ${inDeck.length}` : "deck empty"),
  );
  stage.append(crumb);
  if (inDeck.length === 0) {
    stage.append(h("div", "ghost-shelf", `your first ${state.activeKind} lands here · import or start fresh`));
  } else {
    const vctx: DeckViewContext = {
      entities: inDeck,
      deck,
      threaded,
      portraitUrl,
      sourceLabel: (e) => sourceLabel(state, e),
      peek: (e) => peekPiece(ctx, e),
      refresh: () => render(ctx, state),
      menu: (el, e) => ctx.menus.attach(el, () => ({ type: "entity", label: e.name, data: e })),
      onPiece: (e) => {
        if (threaded.has(pieceKey(e))) ctx.workbench.remove(e.id, e.kind);
        else ctx.workbench.send(e);
      },
    };
    stage.append(view.render(vctx));
  }
  prosc.append(stage);
  root.append(bar, prosc);
  ctx.setStatus(`${deck.plural.toLowerCase()} · ${inDeck.length} of ${state.entities.length} pieces`);
}

/** Parse a static first-party icon constant into a live SVG node (no innerHTML, house rule). */
const icon = (markup: string): Node =>
  document.importNode(new DOMParser().parseFromString(markup, "image/svg+xml").documentElement, true);

function reload(ctx: AppContext, state: RoomState): void {
  void (async () => {
    state.entities = await ctx.api.listEntities();
    render(ctx, state);
  })();
}

const app: VaudeApp = {
  manifest: {
    id: "library",
    title: "The Library",
    markSvg: MARK_SVG,
    accent: "#3b82f6",
    order: 20,
    subtitle: "app",
    firstRunLanding: true, // JOURNEY 1.1: a fresh studio lands on the two doors
  },
  mount(ctx) {
    // the shelves open on the deck chosen at setup (JOURNEY rule); fall back to characters
    const firstDeck = ctx.prefs.get(PREF_FIRST_DECK);
    const state: RoomState = {
      entities: [],
      activeKind: typeof firstDeck === "string" && firstDeck ? firstDeck : "character",
      formatLabels: new Map(),
    };
    const rerender = (): void => render(ctx, state);
    const unsub = ctx.workbench.onChange(rerender);
    void ctx.api.formats().then((formats) => {
      state.formatLabels = new Map(formats.map((f) => [f.id, f.generic ? "Default" : f.friendly]));
      rerender();
    });
    reload(ctx, state);
    rerender(); // immediate paint while the shelves load
    return unsub;
  },
};

export default app;
