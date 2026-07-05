/**
 * The character editor pane - the thin DOM shell over editor-core (bones transcribed from RC's
 * CharacterEditorBento; skin is the house dark-stage look). Slice 1: the fixed Identity card, the
 * reorderable prose cards, explicit save (button + Ctrl+S) with dirty tracking and a beforeunload
 * guard, and a read-only tail for every canonical field the editor does not write yet, so nothing
 * a card carries ever goes invisible.
 */
import type { AppContext } from "../../app-contract";
import {
  applyEdits,
  computeDirty,
  getAtPath,
  IDENTITY_FIELDS,
  KNOWN_FIELD_ORDER,
  moveCard,
  PROSE_CARDS,
  reconcileOrder,
  type CardDef,
} from "./editor-core";
import { fieldsFor } from "./inspect-core";

const ALL_DEFS: CardDef[] = [...IDENTITY_FIELDS, ...PROSE_CARDS];
const RENDERED = new Set(PROSE_CARDS.map((c) => c.id));
/** inspector labels the editor now owns; the read-only tail shows the rest */
const COVERED_LABELS = new Set([
  "tagline", "description", "personality", "scenario", "first message", "example messages",
  "full name", "title", "age", "pronouns",
]);

const CSS = `
.wbedit{display:flex;flex-direction:column;gap:.7rem;min-width:0}
.ed-bar{display:flex;align-items:center;gap:.6rem}
.ed-save{font-family:var(--font-big);font-weight:800;font-size:.6875rem;letter-spacing:.1em;
  text-transform:uppercase;background:var(--a);color:#0a0a0c;border:3px solid #000;
  box-shadow:3px 3px 0 0 #000;padding:.45rem .9rem;cursor:pointer;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.ed-save:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 0 #000}
.ed-save:active{transform:translate(3px,3px);box-shadow:0 0 0 0 #000}
.ed-save:disabled{opacity:.45;cursor:default;transform:none;box-shadow:3px 3px 0 0 #000}
.ed-flag{display:flex;align-items:center;gap:.4rem;font-family:var(--font-mono);font-size:.625rem;
  font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4a4556}
.ed-flag .fdot{width:8px;height:8px;border:2px solid #000;background:#2b2833}
.ed-flag.on{color:#c9c4d2}
.ed-flag.on .fdot{background:var(--a)}
.ed-card{background:#111015;border:3px solid #000;padding:.6rem .8rem;display:flex;flex-direction:column;gap:.45rem}
.ed-h{display:flex;align-items:center;gap:.5rem}
.ed-k{font-family:var(--font-mono);font-size:.625rem;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:#8f8a9e}
.ed-dot{width:8px;height:8px;flex:none;border:2px solid #000;background:#2b2833}
.ed-dot.full{background:var(--a)}
.ed-mv{margin-left:auto;display:flex;gap:.25rem}
.ed-ar{font-family:var(--font-mono);font-size:.6875rem;font-weight:700;line-height:1;color:#8f8a9e;
  background:transparent;border:2px solid #2b2833;padding:.15rem .4rem;cursor:pointer}
.ed-ar:hover{color:#e7e3da;border-color:#8f8a9e}
.ed-ta{width:100%;background:#0a0a0b;border:2px solid #2b2833;color:#c9c4d2;
  font-family:var(--font-body);font-size:.95rem;line-height:1.55;padding:.55rem;
  min-height:8rem;resize:vertical}
.ed-ta.mono{font-family:var(--font-mono);font-size:.8125rem;line-height:1.6}
.ed-ta:focus,.ed-in:focus{outline:none;border-color:var(--a)}
.ed-cnt{font-family:var(--font-mono);font-size:.5625rem;color:#4a4556;align-self:flex-end}
.ed-idgrid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.ed-field{display:flex;flex-direction:column;gap:.25rem;min-width:0}
.ed-field.span2{grid-column:1/-1}
.ed-in{width:100%;background:#0a0a0b;border:2px solid #2b2833;color:#c9c4d2;
  font-family:var(--font-body);font-size:.9rem;padding:.4rem .55rem}
`;

const CSS_MARK = "data-vaude-editor-css";
function injectCss(): void {
  if (document.head.querySelector(`style[${CSS_MARK}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(CSS_MARK, "");
  style.textContent = CSS;
  document.head.append(style);
}

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const rec = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

export interface EditorHandle {
  root: HTMLElement;
  dispose(): void;
}

/** Build the writable pane for one canonical character. One instance per open piece; the room
 * caches instances so tab switches never drop an unsaved draft. */
export function buildCharacterEditor(opts: {
  entity: unknown;
  api: AppContext["api"];
  setStatus(text: string): void;
}): EditorHandle {
  injectCss();
  const entity = rec(opts.entity);
  let baseline = structuredClone(rec(entity.body));
  const savedOrder = rec(baseline.presentation).fieldOrder;
  const hadOrder = Array.isArray(savedOrder) && savedOrder.length > 0;
  let order = reconcileOrder(savedOrder);
  let orderBaseline = [...order];
  const edits = new Map<string, string>();
  let saving = false;

  const root = h("div", "wbedit");
  const bar = h("div", "ed-bar");
  const save = h("button", "ed-save", "Save") as HTMLButtonElement;
  const flag = h("span", "ed-flag");
  flag.append(h("span", "fdot"), document.createTextNode("saved"));
  bar.append(save, flag);
  root.append(bar);

  const dots = new Map<string, HTMLElement>();
  const isDirty = (): boolean => computeDirty(baseline, edits, ALL_DEFS, orderBaseline, order);

  const sync = (): void => {
    const dirty = isDirty();
    flag.classList.toggle("on", dirty);
    flag.childNodes[1]!.textContent = dirty ? "unsaved changes" : "saved";
    save.disabled = saving || !dirty;
    for (const def of ALL_DEFS) {
      const dot = dots.get(def.id);
      if (dot) dot.classList.toggle("full", (edits.get(def.id) ?? getAtPath(baseline, def.path)) !== "");
    }
  };

  const valueOf = (def: CardDef): string => edits.get(def.id) ?? getAtPath(baseline, def.path);

  // -- identity: the fixed first card (RC's rule: identity never reorders) -------------------------
  const idCard = h("div", "ed-card");
  const idHead = h("div", "ed-h");
  idHead.append(h("span", "ed-k", "identity"), (() => { const d = h("span", "ed-dot"); dots.set("name", d); return d; })());
  const idGrid = h("div", "ed-idgrid");
  for (const def of IDENTITY_FIELDS) {
    const field = h("div", `ed-field${def.id === "name" || def.id === "tagline" ? " span2" : ""}`);
    field.append(h("span", "ed-k", def.label));
    const input = h("input", "ed-in") as HTMLInputElement;
    input.value = valueOf(def);
    input.addEventListener("input", () => {
      edits.set(def.id, input.value);
      sync();
    });
    field.append(input);
    idGrid.append(field);
  }
  idCard.append(idHead, idGrid);
  root.append(idCard);

  // -- the reorderable prose cards ------------------------------------------------------------------
  const cardsHost = h("div", "wbedit");
  cardsHost.style.gap = ".7rem";
  root.append(cardsHost);
  const cardEls = new Map<string, HTMLElement>();

  for (const def of PROSE_CARDS) {
    const card = h("div", "ed-card");
    const head = h("div", "ed-h");
    const dot = h("span", "ed-dot");
    dots.set(def.id, dot);
    head.append(h("span", "ed-k", def.label), dot);
    const mv = h("div", "ed-mv");
    const up = h("button", "ed-ar", "↑") as HTMLButtonElement;
    const down = h("button", "ed-ar", "↓") as HTMLButtonElement;
    up.title = `Move ${def.label} up`;
    down.title = `Move ${def.label} down`;
    const move = (dir: -1 | 1): void => {
      const next = moveCard(order, def.id, dir, RENDERED);
      if (next === order) return;
      order = next;
      layoutCards();
      sync();
    };
    up.addEventListener("click", () => move(-1));
    down.addEventListener("click", () => move(1));
    mv.append(up, down);
    head.append(mv);

    const ta = h("textarea", `ed-ta${def.mono ? " mono" : ""}`) as HTMLTextAreaElement;
    ta.value = valueOf(def);
    ta.spellcheck = false;
    const cnt = h("span", "ed-cnt", `${ta.value.length} chars`);
    ta.addEventListener("input", () => {
      edits.set(def.id, ta.value);
      cnt.textContent = `${ta.value.length} chars`;
      sync();
    });
    card.append(head, ta, cnt);
    cardEls.set(def.id, card);
  }

  function layoutCards(): void {
    for (const id of order) {
      const card = cardEls.get(id);
      if (card) cardsHost.append(card); // appending re-parents in order; unrendered ids just skip
    }
  }
  layoutCards();

  // -- read-only tail: every canonical field the editor does not write yet stays visible -----------
  const tail = fieldsFor("character", baseline).filter((f) => !COVERED_LABELS.has(f.k) );
  if (tail.length) {
    const tailHost = h("div", "wbedit");
    tailHost.style.gap = ".7rem";
    for (const f of tail) {
      const box = h("div", "field");
      box.append(h("div", "fk", f.k), h("div", "fv", f.v));
      tailHost.append(box);
    }
    root.append(tailHost);
  }

  // -- save: explicit, loud on failure, never silently green ---------------------------------------
  async function doSave(): Promise<void> {
    if (saving || !isDirty()) return;
    const name = (edits.get("name") ?? getAtPath(baseline, ["identity", "name"])).trim();
    if (!name) {
      opts.setStatus("a name is required before saving");
      return;
    }
    saving = true;
    sync();
    try {
      const newBody = applyEdits(baseline, edits, ALL_DEFS);
      if (hadOrder || JSON.stringify(order) !== JSON.stringify(KNOWN_FIELD_ORDER)) {
        newBody.presentation = { ...rec(newBody.presentation), fieldOrder: [...order] };
      }
      await opts.api.saveEntity({ ...entity, body: newBody });
      baseline = structuredClone(newBody);
      edits.clear();
      orderBaseline = [...order];
      opts.setStatus(`${name} saved`);
    } catch (e) {
      opts.setStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      saving = false;
      sync();
    }
  }
  save.addEventListener("click", () => void doSave());

  const onKey = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); // the shell owns no save; without this the browser offers to save the page
      void doSave();
    }
  };
  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (isDirty()) e.preventDefault(); // the standard unsaved-changes prompt
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("beforeunload", onBeforeUnload);

  sync();
  return {
    root,
    dispose(): void {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    },
  };
}
