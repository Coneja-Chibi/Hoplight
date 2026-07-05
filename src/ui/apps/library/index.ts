/**
 * The Library app - the shelves. Slice 1 implements the LOCKED first-run (vs-firstrun.html):
 * empty studio = the two giant door-cards; drop/pick files = the import overlay with plain-words
 * receipts (never blocks good files on a bad one); after landing = the collection on the stage.
 * All engine work happens through ctx.api; this file is presentation only.
 */
import type { AppContext, InspectResult, StudioEntitySummary, VaudeApp } from "../../app-contract";

/** the locked shelf-of-books mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><rect x="5" y="8" width="3" height="12"/><rect x="9.5" y="5" width="3" height="15"/><path d="M15 20V9l3-1 1.6 10.8-3.4.6z"/></svg>';

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const STYLE = `
.chipbtn{font-family:var(--font-big);font-weight:900;font-size:.7rem;letter-spacing:.07em;
  text-transform:uppercase;background:var(--panel);color:var(--ink);cursor:pointer;padding:.45rem .8rem}
.chipbtn.primary{background:var(--rose);color:#fff}
.lib{display:flex;flex-direction:column;gap:var(--gap-m);padding:var(--gap-m);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.doorcard{aspect-ratio:2/3;width:clamp(11rem,22vw,16rem);display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--gap-m);background:var(--panel);color:var(--ink);cursor:pointer;padding:var(--gap-m);text-align:center;
  font-family:var(--font-big);font-weight:900;font-size:clamp(1rem,1.6vw,1.3rem);line-height:1.15}
.doorcard.primary{background:var(--rose);color:#fff}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,10rem),1fr));gap:var(--gap-m)}
.ecard{display:flex;flex-direction:column;background:var(--panel);cursor:pointer;text-align:left;padding:0}
.ecard .face{aspect-ratio:2/3;background:var(--stage-2);border-bottom:var(--ink-border);display:flex;align-items:flex-end;padding:.5rem;
  font-family:var(--font-big);font-weight:900;font-size:2rem;color:var(--muted);
  background-size:cover;background-position:center top}
.ecard .bd{padding:.45rem .6rem;font-size:.95rem}
.ecard .meta{font-family:var(--font-mono);font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:var(--gap-l);z-index:50}
.sheet{background:var(--paper);color:var(--ink);border:var(--ink-border);box-shadow:8px 8px 0 0 var(--ink);
  max-width:38rem;width:100%;max-height:85dvh;overflow:auto;padding:var(--gap-l);display:flex;flex-direction:column;gap:var(--gap-m)}
.receipt{border:var(--ink-border);background:var(--panel);padding:var(--gap-m)}
.receipt h3{margin:0 0 .2rem;font-family:var(--font-big);font-size:1.1rem}
.receipt p{margin:.15rem 0;font-size:1rem}
.receipt.bad{border-style:dashed;color:var(--muted)}
.mono{font-family:var(--font-mono);font-size:.7rem;color:var(--muted)}
.sheet .actions{display:flex;gap:var(--gap-s);flex-wrap:wrap}
`;

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

function render(ctx: AppContext): void {
  void (async () => {
    const entities = await ctx.api.listEntities();
    const root = h("div", "lib");
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.append(style);

    if (entities.length === 0) {
      // FIRST LANDING (locked): two massive door-cards, verbatim copy, nothing else competing.
      const stage = h("div", "stagezone seam");
      const importDoor = h("button", "doorcard primary stamp", "Drag and drop to import asset");
      const freshDoor = h("button", "doorcard stamp", "Click here to start fresh");
      importDoor.addEventListener("click", () => pickFiles((files) => void importFlow(ctx, files, () => render(ctx))));
      freshDoor.addEventListener("click", () => ctx.setStatus("The editor arrives next slice."));
      stage.append(importDoor, freshDoor);
      root.append(stage, h("p", "voice", "Every pack starts with a first card."));
      ctx.setStatus("The Library - empty studio");
    } else {
      const stage = h("div", "seam");
      stage.style.padding = "var(--gap-l)";
      const grid = h("div", "grid");
      for (const s of entities) grid.append(entityCard(ctx, s));
      stage.append(grid);
      root.append(stage);
      ctx.setStatus(`The Library - ${entities.length} ${entities.length === 1 ? "piece" : "pieces"}`);
    }

    // drop works everywhere from minute one
    root.addEventListener("dragover", (e) => e.preventDefault());
    root.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) void importFlow(ctx, files, () => render(ctx));
    });

    ctx.root.replaceChildren(root);
  })();
}

function entityCard(ctx: AppContext, s: StudioEntitySummary): HTMLElement {
  const card = h("button", "ecard stamp");
  const face = h("div", "face", s.hasPortrait ? undefined : s.name.slice(0, 1).toUpperCase());
  if (s.hasPortrait) {
    face.style.backgroundImage = `url("/api/studio/portrait?kind=${encodeURIComponent(s.kind)}&id=${encodeURIComponent(s.id)}")`;
  }
  const bd = h("div", "bd");
  bd.append(h("div", undefined, s.name), h("div", "meta", s.kind));
  card.append(face, bd);
  card.addEventListener("click", () => ctx.openEntity(s));
  return card;
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
    render(ctx);
    return () => undefined;
  },
};

export default app;
