/**
 * The shell store (CONTRACT V2) - the ONE source of truth for shell state: settings, the app
 * manifest roster, the active app, the Workbench's open pieces (they ARE the tab strip), the
 * follow-prompt dialog, the status note, dock collapse, and the context menu's live render state.
 * Plain serializable data only - the future agent-surface plan reads this store directly, so no
 * DOM refs, no React nodes, and no menu-provider functions live in it; those live in ./menus
 * (the same shape as the old _shared/context-menu.ts), whose surface re-exports from here.
 *
 * `ctx.workbench` and `ctx.prefs` (app-contract.ts) are thin adapters over this store's actions and
 * selectors, so app code and shell chrome read state the ONE way CONTRACT V2 requires.
 *
 * Loading the app MODULE behind an id is deliberately NOT store state (a VaudeApp export is not
 * serializable): App.tsx keeps its own module cache and effect keyed on `activeAppId`.
 */
import { create } from "zustand";
import type { MenuItem, MenuTarget, OpenMenu } from "./menus";
import { parseSettings, SETTING_KEYS, type StudioSettings } from "../../studio/settings-shape";
import { decideFollow } from "../follow-core";
import type { AppManifestEntry, StudioEntitySummary } from "../app-contract";
import { apiFetchJson } from "../_shared/api-fetch";
import {
  besideKeys,
  bumpRecents,
  focusKeys,
  keyOf,
  paneKeyOf,
  parseRecents,
  removeKeys,
  stagePressBatch,
  unstagePressPiece,
} from "./store-core";

export type Theme = "paper" | "stage";

const RECENTS_CAP = 60;
const THEME_CACHE_KEY = "vaude.theme";

// -- the context-menu system lives in ./menus (one concept per file); the surface re-exports here
export {
  menus,
  findMenuTarget,
  menuSectionsFor,
  useContextMenu,
} from "./menus";
export type { ContextMenus, MenuItem, MenuProvider, MenuTarget, OpenMenu } from "./menus";

// -- store shape ------------------------------------------------------------------------------------

export interface FollowPrompt {
  count: number;
}

interface ShellState {
  settings: StudioSettings;
  theme: Theme;
  manifests: AppManifestEntry[];
  activeAppId: string;
  openPieces: StudioEntitySummary[];
  activeKey: string;
  /** a second piece pinned beside the active one ("" = single pane); NEVER equals activeKey */
  splitKey: string;
  statusNote: string;
  studioCount: number;
  dockSlim: boolean;
  followPrompt: FollowPrompt | null;
  openMenu: OpenMenu | null;
  /** "kind:id" -> has unsaved edits; the shell tab wears the dot (the ONE dirty indicator) */
  dirtyPieces: Record<string, boolean>;
  /** the Press's staged queue (the staging grammar: pieces arrive from the Library, the room only
   * works this set). Survives app switches like openPieces; in-memory, not persisted. */
  pressQueue: StudioEntitySummary[];

  // -- settings / theme --------------------------------------------------------------------------
  applySettings(next: StudioSettings): void;
  saveSettings(next: StudioSettings): Promise<void>;
  toggleTheme(): void;
  toggleDockSlim(): void;

  // -- manifests / app mounting -------------------------------------------------------------------
  setManifests(manifests: AppManifestEntry[]): void;
  homeApp(): AppManifestEntry | undefined;
  benchApp(): AppManifestEntry | undefined;
  firstLandingApp(): AppManifestEntry | undefined;
  mountApp(id: string): void;
  goHome(): void;

  // -- status bar -----------------------------------------------------------------------------------
  setStatus(text: string): void;
  setStudioCount(n: number): void;

  // -- the Workbench's open pieces ------------------------------------------------------------------
  isOpen(id: string, kind: string): boolean;
  activePiece(): StudioEntitySummary | null;
  /** the piece pinned beside the active one, or null when the stage is a single pane */
  besidePiece(): StudioEntitySummary | null;
  sendMany(pieces: StudioEntitySummary[]): void;
  /** open a piece in the second pane, beside whatever is active (opens it first if needed) */
  openBeside(piece: StudioEntitySummary): void;
  /** collapse back to a single pane (the pinned piece stays open as a tab) */
  closeSplit(): void;

  // -- the Press's staged queue ---------------------------------------------------------------------
  stageForPress(batch: StudioEntitySummary[]): void;
  unstagePress(id: string, kind: string): void;
  clearPress(): void;
  removePiece(id: string, kind: string, focusEntry?: string): void;
  focusPiece(id: string, kind: string, focusEntry?: string): void;
  setPieceDirty(id: string, kind: string, dirty: boolean): void;
  answerFollow(follow: boolean, remember: boolean): void;

  // -- context menu ---------------------------------------------------------------------------------
  /** the caller (Menu.tsx) already resolved the target and its non-empty sections */
  showMenu(x: number, y: number, target: MenuTarget, sections: MenuItem[][]): void;
  closeMenu(): void;
}

function paintTheme(t: Theme, houseAccent?: string): void {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(THEME_CACHE_KEY, t); // pre-paint cache only; settings.json is the truth
  if (houseAccent) document.documentElement.style.setProperty("--accent", houseAccent);
}

export const useShellStore = create<ShellState>((set, get) => ({
  settings: parseSettings(null),
  // guarded: this initializer runs at module eval, which also happens in DOM-less contexts
  // (the desktop bake imports app modules to read manifests) - there the cache simply misses
  theme: (typeof localStorage !== "undefined" ? (localStorage.getItem(THEME_CACHE_KEY) as Theme | null) : null) ?? "paper",
  manifests: [],
  activeAppId: "",
  openPieces: [],
  activeKey: "",
  splitKey: "",
  pressQueue: [],
  statusNote: "",
  studioCount: 0,
  dockSlim: false,
  followPrompt: null,
  openMenu: null,
  dirtyPieces: {},

  applySettings(next) {
    const theme = next.theme ?? "paper";
    paintTheme(theme, next.houseAccent);
    set({ settings: next, theme, dockSlim: next[SETTING_KEYS.dockSlim] === true });
  },

  async saveSettings(next) {
    const prior = get().settings;
    try {
      const saved = await apiFetchJson<StudioSettings>("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        throw new Error("settings save failed");
      }
      get().applySettings(saved);
    } catch (e) {
      get().applySettings(prior);
      const msg = e instanceof Error ? e.message : "settings save failed";
      set({ statusNote: msg });
      throw e;
    }
  },

  toggleTheme() {
    const next: Theme = get().theme === "paper" ? "stage" : "paper";
    void get().saveSettings({ ...get().settings, [SETTING_KEYS.theme]: next });
  },

  toggleDockSlim() {
    const slim = !get().dockSlim;
    void get().saveSettings({ ...get().settings, [SETTING_KEYS.dockSlim]: slim });
  },

  setManifests(manifests) {
    set({ manifests });
  },

  homeApp() {
    const { manifests, settings } = get();
    const chosen = settings[SETTING_KEYS.homeApp];
    return (
      manifests.find((m) => m.id === chosen && !m.comingSoon && !m.dockFoot) ??
      manifests.find((m) => !m.comingSoon && !m.dockFoot)
    );
  },

  benchApp() {
    return get().manifests.find((m) => m.editsPieces && !m.comingSoon);
  },

  firstLandingApp() {
    return get().manifests.find((m) => m.firstRunLanding && !m.comingSoon);
  },

  mountApp(id) {
    const m = get().manifests.find((a) => a.id === id);
    if (!m || m.comingSoon || m.id === get().activeAppId) return;
    set({ activeAppId: m.id, statusNote: "" });
    // Session-scoped memory of where you are: a dev reload (or any full reload) lands you back on
    // THIS app instead of dumping you on home - the "spits me out on the workbench" complaint.
    try {
      sessionStorage.setItem("vaude.session.activeApp", m.id);
    } catch {
      // storage unavailable (privacy mode) - reloads fall back to home, which is survivable
    }
  },

  goHome() {
    const home = get().homeApp();
    if (home) get().mountApp(home.id);
  },

  setStatus(text) {
    if (get().statusNote === text) return; // idempotent: same-value writes no-op, so any
    set({ statusNote: text });             // effect-echo loop settles in one pass instead of spinning
  },

  setStudioCount(n) {
    if (get().studioCount === n) return; // idempotent (same loop-killing rule as setStatus)
    set({ studioCount: n });
  },

  isOpen(id, kind) {
    return get().openPieces.some((p) => p.id === id && p.kind === kind);
  },

  activePiece() {
    const { openPieces, activeKey } = get();
    return openPieces.find((p) => paneKeyOf(p) === activeKey) ?? null;
  },

  besidePiece() {
    const { openPieces, splitKey } = get();
    if (!splitKey) return null;
    return openPieces.find((p) => paneKeyOf(p) === splitKey) ?? null;
  },

  sendMany(batch) {
    const { openPieces, settings, activeAppId } = get();
    const fresh = batch.filter((p) => !get().isOpen(p.id, p.kind));
    if (fresh.length === 0) {
      const only = batch[0];
      set({
        statusNote: only && batch.length === 1 ? `${only.name} is already on the Workbench` : "already on the Workbench",
      });
      return;
    }

    const onWorkbench = activeAppId !== "" && activeAppId === get().benchApp()?.id;
    const freshKeys = fresh.map((p) => keyOf(p.id, p.kind));
    const now = Date.now();
    const recents = bumpRecents(parseRecents(settings[SETTING_KEYS.workbenchRecents]), freshKeys, now, RECENTS_CAP);
    void get().saveSettings({ ...settings, [SETTING_KEYS.workbenchRecents]: recents });

    const last = fresh[fresh.length - 1]!;
    const action = decideFollow(onWorkbench, settings[SETTING_KEYS.workbenchFollow]);
    const nextOpenPieces = [...openPieces, ...fresh];
    // surface/navigate land the view on the newest piece; note/ask keep the current active piece
    const nextActiveKey =
      action === "surface" || action === "navigate"
        ? paneKeyOf(last)
        : get().activeKey || paneKeyOf(fresh[0]!);
    set({ openPieces: nextOpenPieces, activeKey: nextActiveKey });

    if (action === "navigate") {
      const bench = get().benchApp();
      if (bench) get().mountApp(bench.id);
    } else if (action === "note") {
      set({
        statusNote:
          fresh.length === 1 ? `${fresh[0]!.name} sent to the Workbench` : `${fresh.length} pieces sent to the Workbench`,
      });
    } else if (action === "ask") {
      set({ followPrompt: { count: fresh.length } });
    }
  },

  setPieceDirty(id, kind, dirty) {
    const key = keyOf(id, kind);
    const cur = get().dirtyPieces;
    if ((cur[key] === true) === dirty) return; // idempotent (the loop-killing store rule)
    const next = { ...cur };
    if (dirty) next[key] = true;
    else delete next[key];
    set({ dirtyPieces: next });
  },

  openBeside(piece) {
    const { activeKey, splitKey, settings, openPieces } = get();
    const key = paneKeyOf(piece);
    // Pane identity includes focusEntry so the same lorebook can sit beside itself.
    const already = openPieces.some((p) => paneKeyOf(p) === key);
    if (!already) {
      // an explicit "open beside" skips the follow prompt: the user is already steering the bench
      set({ openPieces: [...get().openPieces, piece] });
      const now = Date.now();
      const recents = bumpRecents(
        parseRecents(settings[SETTING_KEYS.workbenchRecents]),
        [keyOf(piece.id, piece.kind)],
        now,
        RECENTS_CAP,
      );
      void get().saveSettings({ ...settings, [SETTING_KEYS.workbenchRecents]: recents });
    }
    set(besideKeys({ activeKey, splitKey }, key));
    const bench = get().benchApp();
    if (bench) get().mountApp(bench.id);
  },

  closeSplit() {
    if (get().splitKey) set({ splitKey: "" });
  },

  removePiece(id, kind, focusEntry) {
    const { openPieces, activeKey, splitKey, dirtyPieces } = get();
    const want = paneKeyOf({ id, kind, params: focusEntry ? { focusEntry } : undefined });
    const at = openPieces.findIndex((p) => paneKeyOf(p) === want);
    // Fallback: first matching id+kind when no focusEntry (legacy callers).
    const idx =
      at >= 0
        ? at
        : openPieces.findIndex((p) => p.id === id && p.kind === kind);
    if (idx < 0) return;
    const removed = openPieces[idx]!;
    const removedKey = paneKeyOf(removed);
    const next = [...openPieces.slice(0, idx), ...openPieces.slice(idx + 1)];
    const stillOpen = next.some((p) => p.id === id && p.kind === kind);
    const fallback = next[0] ? paneKeyOf(next[0]) : "";
    const nextDirty = { ...dirtyPieces };
    // Dirty is entity-level: only clear when no pane of this entity remains.
    if (!stillOpen) delete nextDirty[keyOf(id, kind)];
    set({
      openPieces: next,
      ...removeKeys({ activeKey, splitKey }, removedKey, fallback),
      dirtyPieces: nextDirty,
    });
  },

  focusPiece(id, kind, focusEntry) {
    const { openPieces, settings, activeKey, splitKey } = get();
    const want = paneKeyOf({ id, kind, params: focusEntry ? { focusEntry } : undefined });
    const hit =
      openPieces.find((p) => paneKeyOf(p) === want) ??
      openPieces.find((p) => p.id === id && p.kind === kind);
    if (!hit) return;
    const key = paneKeyOf(hit);
    const now = Date.now();
    const recents = bumpRecents(
      parseRecents(settings[SETTING_KEYS.workbenchRecents]),
      [keyOf(id, kind)],
      now,
      RECENTS_CAP,
    );
    void get().saveSettings({ ...settings, [SETTING_KEYS.workbenchRecents]: recents });
    set(focusKeys({ activeKey, splitKey }, key));
    const bench = get().benchApp();
    if (bench) get().mountApp(bench.id);
  },

  stageForPress(batch) {
    const before = get().pressQueue;
    const next = stagePressBatch(before, batch);
    if (next.length === before.length) {
      set({ statusNote: batch.length === 1 ? `${batch[0]!.name} is already staged for the Press` : "already staged for the Press" });
      return;
    }
    set({ pressQueue: next, statusNote: `staged for the Press · ${next.length} in the queue` });
  },

  unstagePress(id, kind) {
    set({ pressQueue: unstagePressPiece(get().pressQueue, id, kind) });
  },

  clearPress() {
    set({ pressQueue: [] });
  },

  answerFollow(follow, remember) {
    const { settings } = get();
    set({ followPrompt: null });
    if (remember) {
      void get().saveSettings({ ...settings, [SETTING_KEYS.workbenchFollow]: follow ? "always" : "never" });
    }
    if (follow) {
      const bench = get().benchApp();
      if (bench) get().mountApp(bench.id);
    }
  },

  showMenu(x, y, target, sections) {
    set({ openMenu: { x, y, target, sections } });
  },

  closeMenu() {
    if (get().openMenu) set({ openMenu: null });
  },
}));

/** Read the persisted recents map straight off current settings (the recents rail's data source). */
export function workbenchRecents(): Record<string, number> {
  return parseRecents(useShellStore.getState().settings[SETTING_KEYS.workbenchRecents]);
}

// -- write-storm tripwire ---------------------------------------------------------------------------
// A burst of store writes inside one task is ALWAYS a bug (a render-phase write or an effect echo
// loop). React's own failure mode is a frozen app with "Maximum update depth exceeded" pointing at
// its internals; this converts the storm into a loud, NAMED error at the write site instead. The
// idempotent-setter rule above prevents the common class; this catches whatever invents a new one.
const WRITE_STORM_LIMIT = 150;
let writesThisTask = 0;
let resetQueued = false;
useShellStore.subscribe(() => {
  writesThisTask++;
  if (!resetQueued) {
    resetQueued = true;
    setTimeout(() => {
      writesThisTask = 0;
      resetQueued = false;
    }, 0);
  }
  if (writesThisTask > WRITE_STORM_LIMIT) {
    writesThisTask = 0;
    throw new Error(
      "shell-store: write storm - more than 150 store writes in one task. Almost certainly a " +
        "render-phase store write or an effect that writes what it subscribes to. Check the stack.",
    );
  }
});
