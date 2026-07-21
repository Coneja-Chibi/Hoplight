/**
 * Hoplight.exe - the desktop entry. Compiled by scripts/build-desktop.ts (bun build --compile).
 * Real software: OUR process opens a native WebView2 window (webview-bun, MIT, the OS's own
 * webview - no browser dependency, no Electron), so the window and taskbar wear the beam-V icon
 * baked into this exe. The server owns the MAIN thread; the window's blocking message pump lives
 * in a worker (it starves the event loop otherwise - verified). Window closes -> studio exits.
 */
import { homedir } from "node:os";
import { startUi } from "./ui/server";
import { registerPackagedFormats } from "./generated/packaged-formats";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";
import { resolveDefaultStudioDir } from "./studio/resolve-dir";

const PORT = 8321;
const PORT_TRIES = 10;

// The committed module is a null placeholder; only scripts/build-desktop.ts bakes the real one.
// Failing loud beats a compiled exe silently serving nothing (or a stale checkout's UI).
if (PACKAGED_ASSETS === null) {
  throw new Error("desktop: assets not baked - build with: bun run scripts/build-desktop.ts");
}
const assets = PACKAGED_ASSETS;
registerPackagedFormats();
const studioDir = resolveDefaultStudioDir(homedir());

/** A Hoplight already listening here? Its own /api/version answers with a version string. */
async function runningHoplightAt(port: number): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === "string" ? `http://127.0.0.1:${port}` : null;
  } catch {
    return null;
  }
}

/**
 * Claim a port for the studio. The exe used to hard-bind 8321 and die on EADDRINUSE, which read as
 * "the download does not work" the moment a dev server or an earlier launch held the port (field
 * report). Now: a Hoplight already on the port just gets ANOTHER WINDOW (its server stays its
 * own); a foreign listener makes us walk forward to the next port.
 */
async function claimStudio(): Promise<{ url: string; stop: () => void }> {
  for (let port = PORT; port < PORT + PORT_TRIES; port++) {
    try {
      const { url, stop } = startUi(port, studioDir, assets);
      return { url, stop };
    } catch {
      const existing = await runningHoplightAt(port);
      if (existing) return { url: existing, stop: () => {} };
    }
  }
  throw new Error(`desktop: no free port between ${PORT} and ${PORT + PORT_TRIES - 1}`);
}

const { url: uiUrl, stop } = await claimStudio();
console.log(`Hoplight. is up at ${uiUrl} (studio: ${studioDir})`);

// The RELATIVE STRING LITERAL is load-bearing: it is the one specifier Bun's compiler recognizes
// for workers in a standalone executable (paired with the second entrypoint in build-desktop.ts).
// Anything computed (join, new URL().href) compiles fine and then boots HEADLESS with the console
// hidden (worker ModuleNotFound at B:\~BUN\root), which field reports read as "the download does
// nothing" - the v0.1.0 release shipped exactly that.
const windowWorker = new Worker("./desktop-window.ts");
windowWorker.addEventListener("error", (e) => {
  console.error("desktop: window worker error:", (e as ErrorEvent).message ?? e);
});
windowWorker.postMessage({ url: uiUrl, title: "Hoplight." });
windowWorker.onmessage = () => {
  stop();
  process.exit(0);
};
