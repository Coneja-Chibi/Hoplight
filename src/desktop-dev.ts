/**
 * Vaude (dev) - the native desktop window over the LIVE source. Same WebView2 window as Vaude.exe,
 * but it never bakes a snapshot: it discovers formats from src/formats and serves the UI straight
 * from src/ui, hot-reloading every open page on edit. So it is ALWAYS current - no compile, no
 * re-snapshot, ever. Run on your own dev machine (Bun + this source tree present):
 *   bun run src/desktop-dev.ts
 * A Start Menu shortcut launches exactly this, so the search-bar "Vaude" opens today's code.
 *
 * The shipped Vaude.exe (scripts/build-desktop.ts) stays the baked build - a frozen release a user
 * can run without Bun or the source. This dev entry is its live-source twin, for us only.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { loadFormats } from "./core";
import { startUi } from "./ui/server";

const PORT = 8321;
const DEV_URL = `http://127.0.0.1:${PORT}`;

/** True if something is already listening on the dev port (another Vaude (dev)). */
async function portBusy(port: number): Promise<boolean> {
  try {
    const s = Bun.listen({
      hostname: "127.0.0.1",
      port,
      socket: {
        data() {},
        open() {},
        close() {},
        error() {},
      },
    });
    s.stop(true);
    return false;
  } catch {
    return true;
  }
}

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

if (await portBusy(PORT)) {
  // Second click of the Start Menu tile: process is already up, window may be hidden.
  // Do not crash on EADDRINUSE - send them to the live UI.
  console.log(`Vaude (dev) is already running at ${DEV_URL}`);
  console.log(
    "Opening in your browser. If the native window is stuck, end bun desktop-dev in Task Manager and launch again.",
  );
  openInBrowser(DEV_URL);
  process.exit(0);
}

await loadFormats(); // discover adapters from src/formats (the CLI's proven dev path)
const studioDir = join(homedir(), "Documents", "Vaude Studio");
const { url: uiUrl, stop } = startUi(PORT, studioDir); // no packaged assets -> live source + dev watch
console.log(`Vaude (dev) is up at ${uiUrl} - live source, no rebuild needed`);

// Use import.meta.dir (string path). Avoid `new URL(..., import.meta.url)` after binding a `url`
// variable - Bun has mis-resolved that as a constructor error on Windows ("http://... is not a constructor").
const windowWorker = new Worker(join(import.meta.dir, "desktop-window.ts"));
windowWorker.addEventListener("error", (e) => {
  // a silent worker crash is why "nothing pops up": surface it instead of dying quietly
  console.error("desktop-dev: window worker error:", (e as ErrorEvent).message ?? e);
  openInBrowser(uiUrl);
});
windowWorker.postMessage({ url: uiUrl, title: "Vaude (Dev)" });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
