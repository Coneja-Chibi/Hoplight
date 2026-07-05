/**
 * Vaude.exe - the desktop entry. Compiled by scripts/build-desktop.ts (bun build --compile), so
 * everything here is statically imported and baked in: the format adapters (generated static
 * registry - a compiled binary cannot glob a source tree) and the UI assets. Boots the loopback
 * server, then opens the studio as an app window. The studio folder lives in the user's Documents.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { startUi } from "./ui/server";
import { registerPackagedFormats } from "./generated/packaged-formats";
import { PACKAGED_ASSETS } from "./generated/packaged-assets";

const PORT = 8321;

registerPackagedFormats();
const studioDir = join(homedir(), "Documents", "Vaude Studio");
const { url } = startUi(PORT, studioDir, PACKAGED_ASSETS);

// Open as an app window (chromeless) where a Chromium is present; plain default browser otherwise.
// "cmd /c start" resolves the user's own installs; failures fall through silently to the next.
const attempts: string[][] = [
  ["cmd", "/c", "start", "msedge", `--app=${url}`],
  ["cmd", "/c", "start", "chrome", `--app=${url}`],
  ["cmd", "/c", "start", "", url],
];
for (const cmd of attempts) {
  try {
    const proc = Bun.spawnSync(cmd, { stdout: "ignore", stderr: "ignore" });
    if (proc.exitCode === 0) break;
  } catch {
    /* try the next launcher */
  }
}

console.log(`Vaude. is up at ${url} (studio: ${studioDir})`);
// Bun.serve keeps the process alive; closing the console/tray kills the studio server.
