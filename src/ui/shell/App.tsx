/**
 * App - the shell's React root (CONTRACT V2). Boots settings-first (gates the first-run wizard),
 * discovers the app manifest roster, lands on the right app, and renders the locked chrome (Dock,
 * TopBar, TabStrip, the active app's canvas, StatusBar) plus the follow dialog and context menu.
 * Owns the shell-owned menu providers (entity/app/shell) and the loaded-app-module cache - the
 * module itself is NOT store state (not serializable), so it lives in a ref here.
 *
 * SETUP SEAM (owned by the setup-conversion agent): src/ui/setup/wizard.ts converts its vanilla
 * `runSetup` into a React component named `SetupWizard` matching:
 *   (props: { ctx: SetupContext; existing: StudioSettings; onComplete: (s: StudioSettings) => void })
 *     => ReactNode
 * Until that lands, the import below is a listed, owned tsc error (NO-ROT: this file never wraps
 * the vanilla wizard in a compatibility shim).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { api } from "../api";
import type { AppContext, AppManifestEntry, StudioEntitySummary, HoplightApp } from "../app-contract";
import { parseSettings, type StudioSettings } from "../../studio/settings-shape";
import { SetupWizard } from "../setup/wizard";
import { Dock } from "./Dock";
import { TabStrip } from "./TabStrip";
import { StatusBar } from "./StatusBar";
import { DropVeil } from "./DropVeil";
import { requestImport } from "../_shared/import-signal";
import { FollowDialog } from "./FollowDialog";
import { Menu } from "./Menu";
import { LeavingGate } from "../components/leaving-gate";
import { TourGuide } from "../components/tour-guide";
import type { Tour } from "../tours/tour-contract";
import { hasSeenTour, isRunnable, seenTourKeys, tourIdCandidates, tourSeenKey } from "../tours/tour-core";
import { menus, useShellStore, workbenchRecents } from "./store";
import { paneKeyOf } from "./store-core";

type Phase = "loading" | "setup" | "ready" | "boot-error";

export function App(): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>("loading");
  const [bootError, setBootError] = useState<string | null>(null);
  const modulesRef = useRef(new Map<string, HoplightApp>());
  const [ActiveComponent, setActiveComponent] = useState<HoplightApp["Component"] | null>(null);
  const activeAppId = useShellStore((s) => s.activeAppId);
  // the active app's tour (folders-as-schema, loaded like an app module); null = this app has none
  const toursRef = useRef(new Map<string, Tour | null>());
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // -- boot: settings first (gates the wizard), then the app roster + landing app -------------------
  async function bootStudio(freshFromSetup: boolean): Promise<void> {
    const appsRes = await fetch("/api/apps");
    if (!appsRes.ok) throw new Error("could not load app roster");
    const manifestList = ((await appsRes.json()) as AppManifestEntry[]).sort(
      (a, b) => a.order - b.order,
    );
    useShellStore.getState().setManifests(manifestList);
    const entities = await api.listEntities();
    useShellStore.getState().setStudioCount(entities.length);

    const state = useShellStore.getState();
    const landing = freshFromSetup ? state.firstLandingApp() : undefined;
    // A reload (dev live-reload included) returns to the app you were ON, not home: without this,
    // every source save while the studio is open dumped the user back on the workbench.
    let remembered: AppManifestEntry | undefined;
    try {
      const id = sessionStorage.getItem("vaude.session.activeApp");
      remembered = id ? manifestList.find((m) => m.id === id && !m.comingSoon) : undefined;
    } catch {
      remembered = undefined;
    }
    const first = landing ?? remembered ?? state.homeApp();
    if (first) state.mountApp(first.id);
    setPhase("ready");
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "could not read settings");
        }
        const raw = await res.json();
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error("could not read settings");
        }
        const stored = parseSettings(raw);
        useShellStore.getState().applySettings(stored);
        if (!stored.setupComplete) {
          // FIRST RUN (DECISIONS #10): the wizard owns the screen; the setup surface itself is paper
          document.documentElement.dataset.theme = "paper";
          setPhase("setup");
          return;
        }
        await bootStudio(false);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : "could not start Studio");
        setPhase("boot-error");
      }
    })();
    // boot runs exactly once; bootStudio is stable for the component's lifetime
  }, []);

  const onSetupComplete = (chosen: StudioSettings): void => {
    void (async () => {
      await useShellStore.getState().saveSettings(chosen);
      await bootStudio(true);
    })();
  };

  // -- load the active app's module fresh, cache it (module identity is not store state) ------------
  useEffect(() => {
    if (!activeAppId) {
      setActiveComponent(null);
      return;
    }
    const cached = modulesRef.current.get(activeAppId);
    if (cached) {
      setActiveComponent(() => cached.Component);
      return;
    }
    // The old app must leave the canvas NOW: dev bundles an uncached app on demand (seconds), and
    // keeping the previous component rendered while the dock highlights the new one reads as "it
    // forced me back to the workbench". Null renders the loading canvas until the module lands.
    setActiveComponent(null);
    let cancelled = false;
    void (async () => {
      // A failed chunk load (stale hash, network blip) must say so: unguarded, the dock highlights
      // the new app while the canvas sits empty.
      try {
        const mod = (await import(`/apps/${activeAppId}.js`)) as { default: HoplightApp };
        modulesRef.current.set(activeAppId, mod.default);
        if (!cancelled) setActiveComponent(() => mod.default.Component);
      } catch {
        if (!cancelled) {
          useShellStore.getState().setStatus(`could not load ${activeAppId} · reload and try again`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAppId]);

  // -- idle-prefetch the whole roster so a FIRST click on any app is instant, not a dev-bundle wait --
  const manifests = useShellStore((s) => s.manifests);
  useEffect(() => {
    if (manifests.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const m of manifests) {
        if (cancelled || m.comingSoon || modulesRef.current.has(m.id)) continue;
        try {
          const mod = (await import(`/apps/${m.id}.js`)) as { default: HoplightApp };
          modulesRef.current.set(m.id, mod.default);
        } catch {
          // prefetch is best-effort; the on-demand path above still owns the honest failure story
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifests]);

  // -- load the view's tour (if any) and auto-launch it once, on first visit ------------------------
  // On the Workbench, the "?" serves the ACTIVE PIECE'S KIND (workbench-lorebook, workbench-regex,
  // ...), falling back to the base workbench tour; each kind carries its own seen-flag via its
  // manifest.appId, so first-opening a lorebook can auto-offer its walkthrough.
  const activePieceKind = useShellStore((s) => {
    const p = s.openPieces.find((pp) => paneKeyOf(pp) === s.activeKey);
    return p?.kind ?? null;
  });
  useEffect(() => {
    if (!activeAppId) {
      setTour(null);
      setTourOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const benchId = useShellStore.getState().benchApp()?.id;
      let t: Tour | null = null;
      for (const id of tourIdCandidates(activeAppId, benchId, activePieceKind)) {
        let cachedTour = toursRef.current.get(id);
        if (cachedTour === undefined) {
          try {
            const mod = (await import(`/tours/${id}.js`)) as { default: Tour };
            cachedTour = isRunnable(mod.default) ? mod.default : null;
          } catch {
            cachedTour = null; // no tour under this id (a 404) - the common case, not an error
          }
          toursRef.current.set(id, cachedTour);
        }
        if (cachedTour) {
          t = cachedTour;
          break;
        }
      }
      if (cancelled) return;
      setTour(t);
      const seen = t ? hasSeenTour(useShellStore.getState().settings[tourSeenKey(t.manifest.appId)]) : true;
      setTourOpen(!!t && !seen); // first visit with an unseen tour opens it; otherwise it waits on ?
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAppId, activePieceKind]);

  // -- shell-owned context-menu providers (identical in every room), registered once -----------------
  useEffect(() => {
    const unregisterEntity = menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const wb = useShellStore.getState();
      const key = `${e.kind}:${e.id}`;
      if (wb.isOpen(e.id, e.kind)) {
        const items = [{ label: "Show on the Workbench", onPick: () => wb.focusPiece(e.id, e.kind) }];
        // the split slots: pin beside the active piece, or unpin if this IS the pinned piece
        if (key === wb.splitKey) {
          items.push({ label: "Close the split", onPick: () => wb.closeSplit() });
        } else if (wb.activeKey && key !== wb.activeKey) {
          items.push({ label: "Open beside", onPick: () => wb.openBeside(e) });
        }
        items.push({ label: "Stage for the Press", onPick: () => wb.stageForPress([e]) });
        items.push({ label: "Remove from the Workbench", onPick: () => wb.removePiece(e.id, e.kind) });
        return items;
      }
      const items = [{ label: "Send to the Workbench", onPick: () => wb.sendMany([e]) }];
      if (wb.activeKey) items.push({ label: "Open beside", onPick: () => wb.openBeside(e) });
      items.push({ label: "Stage for the Press", onPick: () => wb.stageForPress([e]) });
      return items;
    });

    const unregisterApp = menus.register("app", (t) => {
      const m = t.data as AppManifestEntry;
      if (m.comingSoon) return [{ label: "Installs later", disabled: true, onPick: () => undefined }];
      return [{ label: `Open ${m.title}`, onPick: () => useShellStore.getState().mountApp(m.id) }];
    });

    const unregisterShell = menus.register("shell", () => [
      { label: "Go home", onPick: () => useShellStore.getState().goHome() },
      {
        label: "Import files",
        onPick: () => {
          const state = useShellStore.getState();
          const shelves = state.firstLandingApp();
          if (shelves) state.mountApp(shelves.id);
          requestImport();
          state.setStatus("pick files to import · or drop them anywhere");
        },
      },
      { label: "Switch theme", onPick: () => useShellStore.getState().toggleTheme() },
      {
        label: "Replay tutorials",
        onPick: () => {
          // clear every tour's seen flag so each app's tour auto-launches again on its next visit
          const s = useShellStore.getState();
          const cleared: Record<string, unknown> = {};
          for (const k of seenTourKeys(s.settings)) cleared[k] = false;
          s.patchSettings(cleared);
          s.setStatus("tutorials will show again");
        },
      },
    ]);

    const detachShellTarget = menus.attach(document.body, () => ({ type: "shell", label: "Hoplight." }));

    return () => {
      unregisterEntity();
      unregisterApp();
      unregisterShell();
      detachShellTarget();
    };
  }, []);

  // -- the AppContext handed to every app; methods read live state via getState() (thin adapters) ---
  // Subscribed to the WHOLE store ON PURPOSE (owner's rule: staleness is a structural impossibility,
  // not a per-slice bugfix). Every store action produces a fresh state object, so any change
  // rebuilds ctx and repaints the active app. If a surface ever measures hot, IT narrows to a
  // selector deliberately; the default is always-correct, never quietly stale.
  const storeState = useShellStore((s) => s);
  const ctx: AppContext = useMemo(
    () => ({
      api,
      setStatus: (text) => useShellStore.getState().setStatus(text),
      apps: () => [...useShellStore.getState().manifests],
      openApp: (id) => useShellStore.getState().mountApp(id),
      menus,
      prefs: {
        get: (key) => useShellStore.getState().settings[key],
        set: (key, value) => {
          useShellStore.getState().patchSettings({ [key]: value });
        },
      },
      workbench: {
        pieces: () => [...useShellStore.getState().openPieces],
        active: () => useShellStore.getState().activePiece(),
        beside: () => useShellStore.getState().besidePiece(),
        send: (s) => useShellStore.getState().sendMany([s]),
        open: (s) => useShellStore.getState().openPiece(s),
        sendMany: (pieces) => useShellStore.getState().sendMany(pieces),
        openBeside: (s) => useShellStore.getState().openBeside(s),
        closeSplit: () => useShellStore.getState().closeSplit(),
        remove: (id, kind) => useShellStore.getState().removePiece(id, kind),
        isOpen: (id, kind) => useShellStore.getState().isOpen(id, kind),
        setDirty: (id, kind, dirty) => useShellStore.getState().setPieceDirty(id, kind, dirty),
        recents: () => workbenchRecents(),
        focus: (id, kind) => useShellStore.getState().focusPiece(id, kind),
        onChange: (cb) =>
          useShellStore.subscribe((state, prev) => {
            if (
              state.openPieces !== prev.openPieces ||
              state.activeKey !== prev.activeKey ||
              state.splitKey !== prev.splitKey
            )
              cb();
          }),
      },
      press: {
        queue: () => [...useShellStore.getState().pressQueue],
        stage: (batch) => useShellStore.getState().stageForPress(batch),
        unstage: (id, kind) => useShellStore.getState().unstagePress(id, kind),
        clear: () => useShellStore.getState().clearPress(),
        onChange: (cb) =>
          useShellStore.subscribe((state, prev) => {
            if (state.pressQueue !== prev.pressQueue) cb();
          }),
      },
    }),
    // storeState is an identity TRIGGER, not a consumed value: its whole job is invalidating ctx on
    // any store change (the anti-staleness rule above); eslint correctly notes it is unused inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeState],
  );

  if (phase === "loading") return null; // chrome renders only from real state; nothing to paint yet

  if (phase === "boot-error") {
    return (
      <div
        id="shell"
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          padding: "2rem",
          fontFamily: "var(--font-body, system-ui)",
        }}
      >
        <div role="alert" style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.75rem" }}>Studio could not start</h1>
          <p style={{ margin: 0, color: "var(--text-soft)" }}>
            {bootError ?? "settings are unreadable. Fix or restore settings.json, then reload."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <SetupWizard
        ctx={{ formats: api.formats }}
        existing={useShellStore.getState().settings}
        onComplete={onSetupComplete}
      />
    );
  }

  return (
    <div id="shell">
      <Dock />
      <div id="main">
        <TabStrip />
        <main id="canvas">
          {ActiveComponent ? (
            <ActiveComponent ctx={ctx} />
          ) : activeAppId ? (
            <div id="canvasLoading">setting the stage…</div>
          ) : null}
        </main>
      </div>
      <StatusBar />
      <DropVeil />
      <FollowDialog />
      <Menu />
      <LeavingGate />
      {tour && isRunnable(tour) && !tourOpen && (
        <button
          className="tourHelp"
          type="button"
          onClick={() => setTourOpen(true)}
          aria-label="Replay the tour"
          title="Replay the tour"
        >
          ?
        </button>
      )}
      {tour && tourOpen && <TourGuide tour={tour} ctx={ctx} onClose={() => setTourOpen(false)} />}
    </div>
  );
}
