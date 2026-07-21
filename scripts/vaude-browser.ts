/**
 * Open Hoplight in the default browser (hot-reloading). Ensures a dev server is up on PORT - starting a
 * detached headless one if none is running - then opens the browser to it. UI edits (tsx/css)
 * hot-reload live via the dev server's reload stream; server-code changes still need the server
 * restarted. The native-window app (desktop-dev.ts) is the other way in; this is the browser way,
 * launched by the "Hoplight (Browser)" Start Menu shortcut.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const PORT = 8321;
const url = `http://localhost:${PORT}`;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const isUp = async (): Promise<boolean> => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(800) });
    return r.status < 500;
  } catch {
    return false;
  }
};

if (!(await isUp())) {
  // start a detached headless dev server that outlives this launcher; process.execPath is the same
  // bun running this script, so no PATH assumption
  const studioDir = join(homedir(), "Documents", "Hoplight Studio");
  spawn(process.execPath, ["run", "src/cli.ts", "ui", String(PORT), studioDir], {
    cwd: repoRoot,
    detached: true,
    stdio: "ignore",
  }).unref();
  for (let i = 0; i < 40 && !(await isUp()); i++) await Bun.sleep(250);
}

// open the default browser (Windows `start`); detached so this launcher can exit immediately
spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
