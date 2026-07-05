/**
 * The shell's client boot - the LOCKED chrome brought to life. Owns: the dock (built from the app
 * manifest, drop-in discovery), app mounting, the tab strip, theme, the tray, the status bar. Owns
 * NO app content and NO format logic: apps get an AppContext and the local API, nothing else.
 */
import type { AppContext, AppManifestEntry, InspectResult, StudioEntitySummary, VaudeApp } from "./app-contract";
import { parseSettings, SETTING_KEYS, type StudioSettings } from "../studio/settings-shape";
import { runSetup } from "./setup/wizard";

type Theme = "paper" | "stage";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const dock = el<HTMLElement>("dock");
const canvas = el<HTMLElement>("canvas");
const tabstrip = el<HTMLElement>("tabstrip");
const statusApp = el<HTMLElement>("statusApp");
const statusStudio = el<HTMLElement>("statusStudio");

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

// -- tabs (the shell owns open pieces; apps request opens) ------------------------------------------

const openTabs: StudioEntitySummary[] = [];
function renderTabs(): void {
  tabstrip.replaceChildren(
    ...openTabs.map((t) => {
      const b = document.createElement("button");
      b.className = "tab";
      const pip = document.createElement("span");
      pip.className = "pip";
      if (t.accent) pip.style.setProperty("--tab-accent", t.accent);
      const label = document.createElement("span");
      label.textContent = t.name;
      b.append(pip, label);
      b.addEventListener("click", () => statusApp && (statusApp.textContent = `${t.name} (editor arrives next slice)`));
      return b;
    }),
  );
}

// -- app mounting -----------------------------------------------------------------------------------

let cleanup: (() => void) | null = null;
let activeId = "";
const modules = new Map<string, VaudeApp>();

async function mountApp(m: AppManifestEntry): Promise<void> {
  if (m.comingSoon || m.id === activeId) return;
  if (cleanup) cleanup();
  canvas.replaceChildren();
  activeId = m.id;
  for (const tile of dock.querySelectorAll<HTMLElement>(".dockapp")) {
    tile.classList.toggle("pressed", tile.dataset.appId === m.id);
  }
  let mod = modules.get(m.id);
  if (!mod) {
    mod = ((await import(`/apps/${m.id}.js`)) as { default: VaudeApp }).default;
    modules.set(m.id, mod);
  }
  const ctx: AppContext = {
    root: canvas,
    theme: (document.documentElement.dataset.theme as Theme) ?? "paper",
    api,
    openEntity: (s) => {
      if (!openTabs.some((t) => t.id === s.id)) openTabs.push(s);
      renderTabs();
    },
    setStatus: (text) => {
      statusApp.textContent = text;
    },
  };
  cleanup = mod.mount(ctx) ?? null;
}

/**
 * Parse a manifest's mark SVG defensively: the dock invites third-party drop-in apps, so their
 * markup is untrusted by doctrine (deny by absence). Only static drawing survives: scripts,
 * foreignObject, use/href indirection, and every on* handler are stripped; a non-svg root is refused.
 */
function sanitizeSvg(markup: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg") return null;
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

function dockTile(m: AppManifestEntry): HTMLElement {
  const b = document.createElement("button");
  b.className = `dockapp stamp${m.comingSoon ? " soon" : ""}`;
  b.dataset.appId = m.id;
  b.style.setProperty("--app-accent", m.accent);
  const mark = document.createElement("span");
  mark.className = "mark";
  const svg = sanitizeSvg(m.markSvg);
  if (svg) mark.append(svg);
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = m.title;
  b.append(mark, label);
  if (m.comingSoon) {
    const small = document.createElement("small");
    small.textContent = "installs later";
    b.append(small);
  } else {
    b.addEventListener("click", () => void mountApp(m));
  }
  return b;
}

// -- boot -------------------------------------------------------------------------------------------

async function boot(): Promise<void> {
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
  dock.replaceChildren(...manifests.map(dockTile));
  const spacer = document.createElement("div");
  spacer.id = "dockspacer";
  const slot = document.createElement("div");
  slot.className = "dockslot";
  slot.title = "Apps can be added - drop a folder in src/ui/apps";
  dock.append(slot, spacer);

  const entities = (await api.listEntities()) as StudioEntitySummary[];
  statusStudio.textContent =
    entities.length === 0 ? "0 pieces - your shelves are empty" : `${entities.length} pieces on the shelves`;

  el<HTMLButtonElement>("brand").addEventListener("click", () => {
    const home = manifests.find((m) => !m.comingSoon);
    if (home) void mountApp(home);
  });

  // JOURNEY 1.1: straight out of setup, land on the app that declared itself the first landing
  const landing = freshFromSetup ? manifests.find((m) => m.firstRunLanding && !m.comingSoon) : undefined;
  const first = landing ?? manifests.find((m) => !m.comingSoon);
  if (first) await mountApp(first);
}

void boot();
