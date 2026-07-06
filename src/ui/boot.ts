/**
 * The shell's client boot (ADR-008, CONTRACT V2) - mounts the React root and wires dev live-reload.
 * All shell behavior (settings, the dock, the Workbench's open pieces, the status bar, the
 * right-click system) lives in shell/App.tsx and shell/store.ts now; this file only bootstraps.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./shell/App";

// pre-paint cache: paint the last-known theme SYNCHRONOUSLY, before the settings fetch resolves,
// so a dark-theme user never flashes paper on reload (settings.json stays the truth; App's boot
// effect repaints from it once fetched - this is only the guess for the first frame)
const cachedTheme = localStorage.getItem("vaude.theme");
if (cachedTheme === "paper" || cachedTheme === "stage") document.documentElement.dataset.theme = cachedTheme;

// plain .ts (no JSX): createElement keeps this the one non-TSX file in the React tree
const mountNode = document.getElementById("shell-root");
if (!mountNode) throw new Error("boot: #shell-root missing from index.html");
createRoot(mountNode).render(createElement(App));

// dev live-reload: the server only streams this in dev; the packaged exe 404s and we go quiet
const devReload = new EventSource("/dev/reload");
devReload.addEventListener("message", (ev) => {
  if (ev.data === "reload") location.reload();
});
devReload.onerror = () => devReload.close();
