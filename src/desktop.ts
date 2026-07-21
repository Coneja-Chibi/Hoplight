/**
 * Hoplight.exe - the desktop entry. Compiled by scripts/build-desktop.ts (bun build --compile).
 * Real software: OUR process opens a native WebView2 window (webview-bun, MIT, the OS's own
 * webview - no browser dependency, no Electron), so the window and taskbar wear the beam-V icon
 * baked into this exe. The server owns the MAIN thread; the window's blocking message pump lives
 * in a worker (it starves the event loop otherwise - verified). Window closes -> studio exits.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { startUi } from "./ui/server";
import { registerPackagedFormats } from "./generated/packaged-formats";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";
import { resolveDefaultStudioDir } from "./studio/resolve-dir";

const PORT = 8321;

// The committed module is a null placeholder; only scripts/build-desktop.ts bakes the real one.
// Failing loud beats a compiled exe silently serving nothing (or a stale checkout's UI).
if (PACKAGED_ASSETS === null) {
  throw new Error("desktop: assets not baked - build with: bun run scripts/build-desktop.ts");
}
registerPackagedFormats();
const studioDir = resolveDefaultStudioDir(homedir());
const { url: uiUrl, stop } = startUi(PORT, studioDir, PACKAGED_ASSETS);
console.log(`Hoplight. is up at ${uiUrl} (studio: ${studioDir})`);

const windowWorker = new Worker(join(import.meta.dir, "desktop-window.ts"));
windowWorker.addEventListener("error", (e) => {
  console.error("desktop: window worker error:", (e as ErrorEvent).message ?? e);
});
windowWorker.postMessage({ url: uiUrl, title: "Hoplight." });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
