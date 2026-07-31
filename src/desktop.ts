/**
 * Hoplight.exe - the desktop entry. Compiled by scripts/build-desktop.ts (bun build --compile).
 * Real software: OUR process opens a native WebView2 window (webview-bun, MIT, the OS's own
 * webview - no browser dependency, no Electron), so the window and taskbar wear the beam-V icon
 * baked into this exe. The server owns the MAIN thread; the window's blocking message pump lives
 * in a worker (it starves the event loop otherwise - verified). Window closes -> studio exits.
 *
 * Every failure path here is REPORTED rather than swallowed - see desktop-boot-report.ts. The exe hides
 * its console, so anything that throws on the way up is otherwise invisible to the person who launched
 * it.
 */
import { homedir } from "node:os";
import { startUi } from "./ui/server";
import { registerPackagedFormats } from "./generated/packaged-formats";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";
import type { PackagedAssets } from "./ui/assets";
import { resolveDefaultStudioDir } from "./studio/resolve-dir";
import { reportBootFailure, reportWindowFailure } from "./desktop-boot-report";

const PORT = 8321;
const PORT_TRIES = 10;

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
async function claimStudio(
  studioDir: string,
  assets: PackagedAssets,
): Promise<{ url: string; stop: () => void }> {
  for (let port = PORT; port < PORT + PORT_TRIES; port++) {
    try {
      const { url, stop } = startUi(port, studioDir, assets);
      return { url, stop };
    } catch {
      const existing = await runningHoplightAt(port);
      if (existing) return { url: existing, stop: () => {} };
    }
  }
  throw new Error(`no free port between ${PORT} and ${PORT + PORT_TRIES - 1}`);
}

/**
 * Bring the studio up and open its window. Throws on any fatal step; the caller turns that into a log
 * file and a dialog. Resolves once the window is handed off - the process then stays alive on the
 * server's own event loop until the window closes.
 */
async function boot(): Promise<void> {
  // The committed module is a null placeholder; only scripts/build-desktop.ts bakes the real one.
  // Failing loud beats a compiled exe silently serving nothing (or a stale checkout's UI).
  if (PACKAGED_ASSETS === null) {
    throw new Error("assets not baked - build with: bun run scripts/build-desktop.ts");
  }
  const assets = PACKAGED_ASSETS;
  registerPackagedFormats();
  const studioDir = resolveDefaultStudioDir(homedir());

  const { url: uiUrl, stop } = await claimStudio(studioDir, assets);
  console.log(`Hoplight. is up at ${uiUrl} (studio: ${studioDir})`);

  // The RELATIVE STRING LITERAL is load-bearing: it is the one specifier Bun's compiler recognizes
  // for workers in a standalone executable (paired with the second entrypoint in build-desktop.ts).
  // Anything computed (join, new URL().href) compiles fine and then boots HEADLESS with the console
  // hidden (worker ModuleNotFound at B:\~BUN\root), which field reports read as "the download does
  // nothing" - the v0.1.0 release shipped exactly that.
  const windowWorker = new Worker("./desktop-window.ts");
  // A window that cannot open is NOT fatal: the studio is already serving, so the user gets told the
  // address and keeps their work. Exiting here would throw away a running studio over a missing
  // system runtime. (A failed native load inside the worker does reach this listener - proven.)
  windowWorker.addEventListener("error", (e) => {
    reportWindowFailure(uiUrl, (e as ErrorEvent).message ?? e);
  });
  windowWorker.postMessage({ url: uiUrl, title: "Hoplight." });
  windowWorker.onmessage = () => {
    stop();
    process.exit(0);
  };
}

try {
  await boot();
} catch (err) {
  reportBootFailure(err);
  process.exit(1);
}
