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
import type { AppContext, AppManifestEntry, StudioEntitySummary, VaudeApp } from "../app-contract";
import { parseSettings, type StudioSettings } from "../../studio/settings-shape";
import { SetupWizard } from "../setup/wizard";
import { Dock } from "./Dock";
import { TabStrip } from "./TabStrip";
import { StatusBar } from "./StatusBar";
import { FollowDialog } from "./FollowDialog";
import { Menu } from "./Menu";
import { LeavingGate } from "../components/leaving-gate";
import { TourGuide } from "../components/tour-guide";
import type { Tour } from "../tours/tour-contract";
import { hasSeenTour, isRunnable, seenTourKeys, tourSeenKey } from "../tours/tour-core";
import { menus, useShellStore, workbenchRecents } from "./store";

type Phase = "loading" | "setup" | "ready";

export function App(): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>("loading");
  const modulesRef = useRef(new Map<string, VaudeApp>());
  const [ActiveComponent, setActiveComponent] = useState<VaudeApp["Component"] | null>(null);
  const activeAppId = useShellStore((s) => s.activeAppId);
  // the active app's tour (folders-as-schema, loaded like an app module); null = this app has none
  const toursRef = useRef(new Map<string, Tour | null>());
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // -- boot: settings first (gates the wizard), then the app roster + landing app -------------------
  async function bootStudio(freshFromSetup: boolean): Promise<void> {
    const manifestList = ((await (await fetch("/api/apps")).json()) as AppManifestEntry[]).sort(
      (a, b) => a.order - b.order,
    );
    useShellStore.getState().setManifests(manifestList);
    const entities = await api.listEntities();
    useShellStore.getState().setStudioCount(entities.length);

    const state = useShellStore.getState();
    const landing = freshFromSetup ? state.firstLandingApp() : undefined;
    const first = landing ?? state.homeApp();
    if (first) state.mountApp(first.id);
    setPhase("ready");
  }

  useEffect(() => {
    void (async () => {
      const stored = parseSettings(await (await fetch("/api/settings")).json().catch(() => null));
      useShellStore.getState().applySettings(stored);
      if (!stored.setupComplete) {
        // FIRST RUN (DECISIONS #10): the wizard owns the screen; the setup surface itself is paper
        document.documentElement.dataset.theme = "paper";
        setPhase("setup");
        return;
      }
      await bootStudio(false);
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
    let cancelled = false;
    void (async () => {
      const mod = (await import(`/apps/${activeAppId}.js`)) as { default: VaudeApp };
      modulesRef.current.set(activeAppId, mod.default);
      if (!cancelled) setActiveComponent(() => mod.default.Component);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAppId]);

  // -- load the active app's tour (if any) and auto-launch it once, on first visit ------------------
  useEffect(() => {
    if (!activeAppId) {
      setTour(null);
      setTourOpen(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      let t = toursRef.current.get(activeAppId);
      if (t === undefined) {
        try {
          const mod = (await import(`/tours/${activeAppId}.js`)) as { default: Tour };
          t = isRunnable(mod.default) ? mod.default : null;
        } catch {
          t = null; // no tour for this app (a 404) - the common case, not an error
        }
        toursRef.current.set(activeAppId, t);
      }
      if (cancelled) return;
      setTour(t);
      const seen = hasSeenTour(useShellStore.getState().settings[tourSeenKey(activeAppId)]);
      setTourOpen(!!t && !seen); // first visit with an unseen tour opens it; otherwise it waits on ?
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAppId]);

  // -- shell-owned context-menu providers (identical in every room), registered once -----------------
  useEffect(() => {
    const unregisterEntity = menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const wb = useShellStore.getState();
      if (wb.isOpen(e.id, e.kind)) {
        return [
          { label: "Show on the Workbench", onPick: () => wb.focusPiece(e.id, e.kind) },
          { label: "Remove from the Workbench", onPick: () => wb.removePiece(e.id, e.kind) },
        ];
      }
      return [{ label: "Send to the Workbench", onPick: () => wb.sendMany([e]) }];
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
          state.setStatus("drop files anywhere on the shelves");
        },
      },
      { label: "Switch theme", onPick: () => useShellStore.getState().toggleTheme() },
      {
        label: "Replay tutorials",
        onPick: () => {
          // clear every tour's seen flag so each app's tour auto-launches again on its next visit
          const s = useShellStore.getState();
          const cleared = { ...s.settings };
          for (const k of seenTourKeys(s.settings)) cleared[k] = false;
          void s.saveSettings(cleared);
          s.setStatus("tutorials will show again");
        },
      },
    ]);

    const detachShellTarget = menus.attach(document.body, () => ({ type: "shell", label: "Vaude." }));

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
      menus,
      prefs: {
        get: (key) => useShellStore.getState().settings[key],
        set: (key, value) => {
          const state = useShellStore.getState();
          void state.saveSettings({ ...state.settings, [key]: value });
        },
      },
      workbench: {
        pieces: () => [...useShellStore.getState().openPieces],
        active: () => useShellStore.getState().activePiece(),
        send: (s) => useShellStore.getState().sendMany([s]),
        sendMany: (pieces) => useShellStore.getState().sendMany(pieces),
        remove: (id, kind) => useShellStore.getState().removePiece(id, kind),
        isOpen: (id, kind) => useShellStore.getState().isOpen(id, kind),
        setDirty: (id, kind, dirty) => useShellStore.getState().setPieceDirty(id, kind, dirty),
        recents: () => workbenchRecents(),
        focus: (id, kind) => useShellStore.getState().focusPiece(id, kind),
        onChange: (cb) =>
          useShellStore.subscribe((state, prev) => {
            if (state.openPieces !== prev.openPieces || state.activeKey !== prev.activeKey) cb();
          }),
      },
    }),
    // storeState is an identity TRIGGER, not a consumed value: its whole job is invalidating ctx on
    // any store change (the anti-staleness rule above); eslint correctly notes it is unused inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeState],
  );

  if (phase === "loading") return null; // chrome renders only from real state; nothing to paint yet

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
        <main id="canvas">{ActiveComponent && <ActiveComponent ctx={ctx} />}</main>
      </div>
      <StatusBar />
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
