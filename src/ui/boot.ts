/**
 * The shell's client boot (ADR-008, CONTRACT V2) - mounts the React root and wires dev live-reload.
 * All shell behavior (settings, the dock, the Workbench's open pieces, the status bar, the
 * right-click system) lives in shell/App.tsx and shell/store.ts now; this file only bootstraps.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./shell/App";
import { ShellErrorBoundary } from "./shell/error-boundary";
import { useShellStore } from "./shell/store";

// pre-paint cache: paint the last-known theme SYNCHRONOUSLY, before the settings fetch resolves,
// so a dark-theme user never flashes paper on reload (settings.json stays the truth; App's boot
// effect repaints from it once fetched - this is only the guess for the first frame)
const cachedTheme = localStorage.getItem("vaude.theme");
if (cachedTheme === "paper" || cachedTheme === "stage") document.documentElement.dataset.theme = cachedTheme;

// plain .ts (no JSX): createElement keeps this the one non-TSX file in the React tree
const mountNode = document.getElementById("shell-root");
if (!mountNode) throw new Error("boot: #shell-root missing from index.html");
// the boundary wraps App, never the other way round: a crash inside App must still leave something
// on screen to act on (see shell/error-boundary.tsx)
createRoot(mountNode).render(createElement(ShellErrorBoundary, null, createElement(App)));

// dev live-reload: the server streams "hello <bootId>" on connect and "reload" on rebuild. Never
// close() on error - EventSource auto-reconnects across transient drops and server restarts, and
// closing on the first hiccup pins the tab to a stale bundle forever (the proven failure: every
// dev-server restart orphaned every open tab). In the packaged exe the endpoint 404s and the
// browser fails the connection permanently on its own, so quiet needs no help from us. A hello
// with a NEW boot id means a different server process (the bundle may have changed): reload once.
const devReload = new EventSource("/dev/reload");
let devBootId: string | null = null;
let devDown = false;
let downTimer: number | null = null;
devReload.addEventListener("message", (ev) => {
  const data = typeof ev.data === "string" ? ev.data : "";
  if (data === "reload") location.reload();
  if (data.startsWith("hello ")) {
    const id = data.slice("hello ".length);
    if (downTimer !== null) {
      clearTimeout(downTimer); // the drop was a blip; never mention it
      downTimer = null;
    }
    if (devBootId === null) devBootId = id;
    else if (devBootId !== id) location.reload();
    else if (devDown) {
      devDown = false;
      useShellStore.getState().setStatus("studio server is back");
    }
  }
});
// While the server is DOWN, every action fails in ways that read as "the app is broken" (pieces
// won't load, saves 403). Say what is actually happening - but only for a SUSTAINED outage: SSE
// streams drop and reconnect routinely on a healthy server, so a bare error is not evidence. The
// note arms on error and only fires if no hello lands within the window (EventSource retries
// ~every 3s, so a live server always beats the timer). Gated on a prior hello, so the packaged
// exe (whose 404 stream errors forever) can never show it.
devReload.addEventListener("error", () => {
  if (devBootId === null || devDown || downTimer !== null) return;
  downTimer = window.setTimeout(() => {
    downTimer = null;
    devDown = true;
    useShellStore.getState().setStatus("studio server is not running · this page reloads itself when it is back");
  }, 8000);
});
