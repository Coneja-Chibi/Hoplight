/**
 * Hoplight (dev) - the native desktop window over the LIVE source. Same WebView2 window as Hoplight.exe,
 * but it never bakes a snapshot: it discovers formats from src/formats and serves the UI straight
 * from src/ui, hot-reloading every open page on edit. So it is ALWAYS current - no compile, no
 * re-snapshot, ever. Run on your own dev machine (Bun + this source tree present):
 *   bun run src/desktop-dev.ts
 * A Start Menu shortcut launches exactly this, so the search-bar "Hoplight" opens today's code.
 *
 * The shipped Hoplight.exe (scripts/build-desktop.ts) stays the baked build - a frozen release a user
 * can run without Bun or the source. This dev entry is its live-source twin, for us only.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { loadFormats } from "./core";
import { startUi } from "./ui/server";
import { claimStudio, desktopPortOverride } from "./ui/port-owner";

const PORT = 8321;
/** Open the UI in the default browser when a native window cannot be created / already running. */
function openInBrowser(url: string): void {
  if (process.platform === "win32") {
    Bun.spawn(["cmd", "/c", "start", "", url], { stdout: "ignore", stderr: "ignore" });
    return;
  }
  Bun.spawn([process.platform === "darwin" ? "open" : "xdg-open", url], {
    stdout: "ignore",
    stderr: "ignore",
  });
}

const override = desktopPortOverride(process.env.HOPLIGHT_PORT);
await loadFormats(); // discover adapters from src/formats (the CLI's proven dev path)
const studioDir = join(homedir(), "Documents", "Hoplight Studio");
const { url: uiUrl, stop } = await claimStudio(override ?? PORT, override === null ? 10 : 1,
  (port) => startUi(port, studioDir), override === null);
console.log(`Hoplight (dev) is up at ${uiUrl} - live source, no rebuild needed`);

// Use import.meta.dir (string path). Avoid `new URL(..., import.meta.url)` after binding a `url`
// variable - Bun has mis-resolved that as a constructor error on Windows ("http://... is not a constructor").
const windowWorker = new Worker(join(import.meta.dir, "desktop-window.ts"));
windowWorker.addEventListener("error", (e) => {
  // a silent worker crash is why "nothing pops up": surface it instead of dying quietly
  console.error("desktop-dev: window worker error:", (e as ErrorEvent).message ?? e);
  openInBrowser(uiUrl);
});
windowWorker.postMessage({ url: uiUrl, title: "Hoplight (Dev)" });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
