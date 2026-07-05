/**
 * The shell's client boot - the LOCKED chrome (vs-shell-apps, DECISIONS #14) brought to life.
 * Owns: the dock (built from the app manifest, drop-in discovery), the top strip crumb, app
 * mounting, THE WORKBENCH's open pieces (they are the tab strip), theme + settings, the status
 * bar, and the right-click system. Owns NO app content and NO format logic: apps get an
 * AppContext and the local API, nothing else. Chrome furniture renders only from REAL state.
 */
import type { AppContext, AppManifestEntry, InspectResult, StudioEntitySummary, VaudeApp } from "./app-contract";
import { parseSettings, SETTING_KEYS, type StudioSettings } from "../studio/settings-shape";
import { deckMeta } from "./_shared/decks";
import { createContextMenus } from "./_shared/context-menu";
import { runSetup } from "./setup/wizard";

type Theme = "paper" | "stage";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const dockApps = el<HTMLElement>("dockapps");
const dockFootApps = el<HTMLElement>("dockfootapps");
const canvas = el<HTMLElement>("canvas");
const tabstrip = el<HTMLElement>("tabstrip");

const h = (tag: string, cls?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

// -- local API (the one door to the engine) ---------------------------------------------------------

const api: AppContext["api"] = {
  listEntities: async (kind) =>
    (await fetch(`/api/studio/list${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`)).json(),
  getEntity: async (id) => (await fetch(`/api/studio/get?${id}`)).json(),
  saveEntity: async (entity) =>
    (
      await fetch("/api/studio/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(entity),
      })
    ).json(),
  inspectFile: async (file): Promise<InspectResult> =>
    (
      await fetch("/api/inspect", {
        method: "POST",
        headers: { "x-filename": file.name },
        body: await file.arrayBuffer(),
      })
    ).json(),
  exportEntity: async (entity, targetId) =>
    (
      await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, targetId }),
      })
    ).json(),
  formats: async () => (await fetch("/api/formats")).json(),
};

// -- settings (the studio's truth; localStorage is only a pre-fetch paint cache) --------------------

const themeKey = "vaude.theme";
let settings: StudioSettings = parseSettings(null);

function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(themeKey, t); // paint cache so the next boot doesn't flash paper on dark users
  el<HTMLElement>("statusTheme").textContent = t === "paper" ? "light" : "dark";
}
setTheme((localStorage.getItem(themeKey) as Theme) ?? "paper");

/** Apply what settings own: theme + the house accent (chrome only, never the brand rose mark). */
function applySettings(s: StudioSettings): void {
  settings = s;
  setTheme(s.theme ?? "paper");
  if (s.houseAccent) document.documentElement.style.setProperty("--accent", s.houseAccent);
}

async function saveSettings(next: StudioSettings): Promise<void> {
  applySettings(next);
  await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
}

el<HTMLButtonElement>("themeBtn").addEventListener("click", () => {
  const next: Theme = document.documentElement.dataset.theme === "paper" ? "stage" : "paper";
  void saveSettings({ ...settings, [SETTING_KEYS.theme]: next });
});

// -- the Workbench's open pieces (shell-owned; they ARE the tab strip) ------------------------------

const openPieces: StudioEntitySummary[] = [];
let activeKey = ""; // "kind:id" of the piece whose editor the Workbench shows
const pieceSubs = new Set<() => void>();
const keyOf = (id: string, kind: string): string => `${kind}:${id}`;

function piecesChanged(): void {
  renderTabs();
  for (const cb of pieceSubs) cb();
}

function goToWorkbench(): void {
  const bench = manifestsCache.find((m) => m.editsPieces && !m.comingSoon);
  if (bench) void mountApp(bench);
}

/** The follow dialog (Chi's spec): Yes goes to the Workbench, No stays, the checkbox makes the
 * answer permanent (changeable any time in Settings). */
function askFollow(count: number): void {
  const overlay = h("div", "vdialog-overlay");
  const sheet = h("div", "vdialog");
  sheet.append(h("p", "msg", `${count} ${count === 1 ? "item was" : "items were"} sent to the Workbench. Follow?`));
  const rememberRow = h("label", "remember");
  const check = document.createElement("input");
  check.type = "checkbox";
  rememberRow.append(check, document.createTextNode("Never ask me this again"));
  const actions = h("div", "actions");
  const answer = (follow: boolean): void => {
    overlay.remove();
    if (check.checked) {
      void saveSettings({ ...settings, [SETTING_KEYS.workbenchFollow]: follow ? "always" : "never" });
    }
    if (follow) goToWorkbench();
  };
  const yes = h("button", "yes", "Yes");
  yes.addEventListener("click", () => answer(true));
  const no = h("button", "no", "No");
  no.addEventListener("click", () => answer(false));
  actions.append(yes, no);
  sheet.append(rememberRow, actions);
  overlay.append(sheet);
  document.body.append(overlay);
  yes.focus();
}

/** Open the not-yet-open pieces and settle the follow behaviour ONCE (single send and batch send
 * share this so the follow dialog always reports the real count). */
function openPiecesBatch(batch: StudioEntitySummary[]): void {
  const fresh = batch.filter((p) => !workbench.isOpen(p.id, p.kind));
  if (fresh.length === 0) {
    const only = batch[0];
    setStatusNote(only && batch.length === 1 ? `${only.name} is already on the Workbench` : "already on the Workbench");
    return;
  }
  for (const p of fresh) {
    openPieces.push(p);
    if (!activeKey) activeKey = keyOf(p.id, p.kind);
  }
  const last = fresh[fresh.length - 1]!; // "always" lands on the last of the batch
  piecesChanged();
  const follow = settings[SETTING_KEYS.workbenchFollow];
  if (follow === "always") {
    activeKey = keyOf(last.id, last.kind);
    piecesChanged();
    goToWorkbench();
  } else if (follow === "never") {
    setStatusNote(
      fresh.length === 1 ? `${fresh[0]!.name} sent to the Workbench` : `${fresh.length} pieces sent to the Workbench`,
    );
  } else {
    askFollow(fresh.length);
  }
}

const workbench: AppContext["workbench"] = {
  pieces: () => [...openPieces],
  active: () => openPieces.find((p) => keyOf(p.id, p.kind) === activeKey) ?? null,
  isOpen: (id, kind) => openPieces.some((p) => p.id === id && p.kind === kind),
  send: (s) => openPiecesBatch([s]),
  sendMany: (pieces) => openPiecesBatch(pieces),
  remove(id, kind) {
    const at = openPieces.findIndex((p) => p.id === id && p.kind === kind);
    if (at < 0) return;
    openPieces.splice(at, 1);
    if (activeKey === keyOf(id, kind)) activeKey = openPieces[0] ? keyOf(openPieces[0].id, openPieces[0].kind) : "";
    piecesChanged();
  },
  focus(id, kind) {
    if (!workbench.isOpen(id, kind)) return;
    activeKey = keyOf(id, kind);
    piecesChanged();
    goToWorkbench();
  },
  onChange(cb) {
    pieceSubs.add(cb);
    return () => pieceSubs.delete(cb);
  },
};

// -- the right-click system (one menu shell; features contribute by registration) -------------------

const menus = createContextMenus();

// entity actions the SHELL owns (the Workbench pieces): identical in every room
menus.register("entity", (t) => {
  const e = t.data as StudioEntitySummary;
  if (workbench.isOpen(e.id, e.kind)) {
    return [
      { label: "Show on the Workbench", onPick: () => workbench.focus(e.id, e.kind) },
      { label: "Remove from the Workbench", onPick: () => workbench.remove(e.id, e.kind) },
    ];
  }
  return [{ label: "Send to the Workbench", onPick: () => workbench.send(e) }];
});

// app tiles answer with their one real action
menus.register("app", (t) => {
  const m = t.data as AppManifestEntry;
  if (m.comingSoon) return [{ label: "Installs later", disabled: true, onPick: () => undefined }];
  return [{ label: `Open ${m.title}`, onPick: () => void mountApp(m) }];
});

// the always-there fallback: EVERY page answers a right-click with real shell actions
menus.register("shell", () => [
  { label: "Go home", onPick: goHome },
  {
    label: "Import files",
    onPick: () => {
      const shelves = manifestsCache.find((m) => m.firstRunLanding && !m.comingSoon);
      if (shelves) void mountApp(shelves);
      setStatusNote("drop files anywhere on the shelves");
    },
  },
  {
    label: "Switch theme",
    onPick: () => {
      const next: Theme = document.documentElement.dataset.theme === "paper" ? "stage" : "paper";
      void saveSettings({ ...settings, [SETTING_KEYS.theme]: next });
    },
  },
]);

// -- tabs (the Workbench's open pieces; clicking one goes to its editor) ----------------------------

function renderTabs(): void {
  tabstrip.classList.toggle("hastabs", openPieces.length > 0);
  const tabs = openPieces.map((t) => {
    const b = h("button", `tab${keyOf(t.id, t.kind) === activeKey ? " active" : ""}`);
    if (t.accent) b.style.setProperty("--a", t.accent);
    b.append(h("span", "pip"));
    b.append(document.createTextNode(t.name));
    b.append(h("span", "kind", deckMeta(t.kind).short));
    const close = h("span", "close", "×");
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      workbench.remove(t.id, t.kind);
    });
    b.append(close);
    b.addEventListener("click", () => workbench.focus(t.id, t.kind));
    menus.attach(b, () => ({ type: "entity", label: t.name, data: t }));
    return b;
  });
  const add = h("button", undefined, "+");
  add.id = "tabadd";
  add.title = "Open another";
  add.addEventListener("click", () => {
    const lib = manifestsCache.find((m) => m.firstRunLanding && !m.comingSoon);
    if (lib) void mountApp(lib);
  });
  tabstrip.replaceChildren(...tabs, add, h("span", "tabfill"));
}

// -- status bar (segments render only real state) ---------------------------------------------------

function setStatusNote(text: string): void {
  const seg = el<HTMLElement>("statusNote");
  seg.replaceChildren();
  if (!text) return;
  seg.append(h("span", "sep", "·"), h("span", "k", text));
}

async function refreshStudioStatus(): Promise<void> {
  const entities = (await api.listEntities()) as StudioEntitySummary[];
  el<HTMLElement>("statusStudio").textContent =
    entities.length === 0 ? "0 · your shelves are empty" : String(entities.length);
}

// -- app mounting -----------------------------------------------------------------------------------

let cleanup: (() => void) | null = null;
let activeId = "";
const modules = new Map<string, VaudeApp>();
let manifestsCache: AppManifestEntry[] = [];

/** The user's chosen home app (Settings), falling back to the first dockable app. */
function homeApp(): AppManifestEntry | undefined {
  const chosen = settings[SETTING_KEYS.homeApp];
  return (
    manifestsCache.find((m) => m.id === chosen && !m.comingSoon && !m.dockFoot) ??
    manifestsCache.find((m) => !m.comingSoon && !m.dockFoot)
  );
}

function goHome(): void {
  const home = homeApp();
  if (home) void mountApp(home);
}

async function mountApp(m: AppManifestEntry): Promise<void> {
  if (m.comingSoon || m.id === activeId) return;
  if (cleanup) cleanup();
  canvas.replaceChildren();
  activeId = m.id;
  for (const tile of document.querySelectorAll<HTMLElement>(".apptile")) {
    const on = tile.dataset.appId === m.id;
    tile.classList.toggle("on", on);
    if (on) tile.setAttribute("aria-current", "page");
    else tile.removeAttribute("aria-current");
  }
  el<HTMLElement>("crumbName").textContent = m.title;
  el<HTMLElement>("statusApp").textContent = m.title.replace(/^The /, "");
  el<HTMLElement>("statusDot").style.setProperty("--adot", m.accent);
  setStatusNote("");
  let mod = modules.get(m.id);
  if (!mod) {
    mod = ((await import(`/apps/${m.id}.js`)) as { default: VaudeApp }).default;
    modules.set(m.id, mod);
  }
  const ctx: AppContext = {
    root: canvas,
    theme: (document.documentElement.dataset.theme as Theme) ?? "paper",
    api,
    setStatus: setStatusNote,
    apps: () => [...manifestsCache],
    menus,
    prefs: {
      get: (key) => settings[key],
      set: (key, value) => void saveSettings({ ...settings, [key]: value }),
    },
    workbench,
  };
  cleanup = mod.mount(ctx) ?? null;
}

/**
 * Parse a manifest's mark SVG defensively: the dock invites third-party drop-in apps, so their
 * markup is untrusted by doctrine (deny by absence). Only static drawing survives: scripts,
 * foreignObject, use/href indirection, and every on* handler are stripped; a non-svg root is refused.
 */
function sanitizeSvg(markup: string): SVGSVGElement | null {
  // tolerate manifests that omit xmlns (without it the parsed nodes never draw)
  const withNs = markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const doc = new DOMParser().parseFromString(withNs, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;
  const banned = new Set(["script", "foreignobject", "use", "animate", "set", "iframe"]);
  for (const node of [root, ...root.querySelectorAll("*")]) {
    if (banned.has(node.nodeName.toLowerCase())) {
      node.remove();
      continue;
    }
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "href" || name === "xlink:href") node.removeAttribute(attr.name);
    }
  }
  return document.importNode(root, true) as unknown as SVGSVGElement;
}

/** One dock tile per the locked anatomy: mark box + name + mono subtitle, accent notch when on. */
function dockTile(m: AppManifestEntry): HTMLElement {
  const b = h("button", `apptile${m.comingSoon ? " future" : ""}`);
  b.dataset.appId = m.id;
  b.style.setProperty("--a", m.accent);
  menus.attach(b, () => ({ type: "app", label: m.title, data: m }));
  const mark = h("span", "mk");
  const svg = sanitizeSvg(m.markSvg);
  if (svg) mark.append(svg);
  const tx = h("span", "tx");
  tx.append(h("span", "nm", m.title), h("span", "kd", m.comingSoon ? "installs later" : (m.subtitle ?? "app")));
  b.append(mark, tx);
  if (m.comingSoon) {
    b.setAttribute("aria-disabled", "true");
    b.tabIndex = -1;
  } else {
    b.addEventListener("click", () => void mountApp(m));
  }
  return b;
}

function buildDock(manifests: AppManifestEntry[]): void {
  const body = manifests.filter((m) => !m.dockFoot);
  const foot = manifests.filter((m) => m.dockFoot);
  const present = body.filter((m) => !m.comingSoon);
  const future = body.filter((m) => m.comingSoon);

  const slot = h("div", "dockslot");
  slot.setAttribute("role", "button");
  slot.title = "Apps can be added - drop a folder in src/ui/apps";
  slot.append(h("span", "plus", "+"), h("span", "sl", "add app"));

  dockApps.replaceChildren(
    h("div", "docklabel", "Apps"),
    ...present.map(dockTile),
    ...(future.length ? [h("div", "dockdiv")] : []),
    ...future.map(dockTile),
    slot,
  );
  dockFootApps.replaceChildren(...foot.map(dockTile));
}

// -- boot -------------------------------------------------------------------------------------------

async function boot(): Promise<void> {
  menus.attach(document.body, () => ({ type: "shell", label: "Vaude." }));
  // settings first: they gate the wizard and skin everything after
  const stored = parseSettings(await (await fetch("/api/settings")).json().catch(() => null));
  applySettings(stored);

  let freshFromSetup = false;
  if (!stored.setupComplete) {
    // FIRST RUN (DECISIONS #10): the wizard owns the screen; the setup surface itself is paper
    document.documentElement.dataset.theme = "paper";
    const chosen = await runSetup({ formats: api.formats }, stored);
    await saveSettings(chosen);
    freshFromSetup = true;
  }

  const manifests = ((await (await fetch("/api/apps")).json()) as AppManifestEntry[]).sort(
    (a, b) => a.order - b.order,
  );
  manifestsCache = manifests;
  buildDock(manifests);
  renderTabs();
  await refreshStudioStatus();

  el<HTMLButtonElement>("dockhome").addEventListener("click", goHome);

  // global IMPORT: the shelves own the flow; the top strip walks you to them
  el<HTMLButtonElement>("importBtn").addEventListener("click", () => {
    const shelves = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
    if (shelves) void mountApp(shelves);
    setStatusNote("drop files anywhere on the shelves");
  });

  // JOURNEY 1.1: straight out of setup, land on the first-landing app; normal boots open the
  // user's chosen home (Settings)
  const landing = freshFromSetup ? manifests.find((m) => m.firstRunLanding && !m.comingSoon) : undefined;
  const first = landing ?? homeApp();
  if (first) await mountApp(first);
}

void boot();

// dev live-reload: the server only streams this in dev; the packaged exe 404s and we go quiet
const devReload = new EventSource("/dev/reload");
devReload.addEventListener("message", (ev) => {
  if (ev.data === "reload") location.reload();
});
devReload.onerror = () => devReload.close();
