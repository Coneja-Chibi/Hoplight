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

await loadFormats(); // discover adapters from src/formats (the CLI's proven dev path)
const studioDir = join(homedir(), "Documents", "Vaude Studio");
const { url, stop } = startUi(PORT, studioDir); // no packaged assets -> live source + dev watch
console.log(`Vaude (dev) is up at ${url} - live source, no rebuild needed`);

const windowWorker = new Worker(new URL("./desktop-window.ts", import.meta.url));
windowWorker.postMessage({ url });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
