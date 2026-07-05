/**
 * Vaude.exe - the desktop entry. Compiled by scripts/build-desktop.ts (bun build --compile).
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

const PORT = 8321;

registerPackagedFormats();
const studioDir = join(homedir(), "Documents", "Vaude Studio");
const { url, stop } = startUi(PORT, studioDir, PACKAGED_ASSETS);
console.log(`Vaude. is up at ${url} (studio: ${studioDir})`);

const windowWorker = new Worker(new URL("./desktop-window.ts", import.meta.url));
windowWorker.postMessage({ url });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
