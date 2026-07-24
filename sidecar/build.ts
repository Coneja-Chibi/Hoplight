/**
 * Build the Hoplight remote-access sidecar. Run: `bun sidecar/build.ts` (from the repo root or here).
 *
 * The recipe is not optional decoration, two flags each fix a real, already-shipped bug:
 *   -H=windowsgui  : the sidecar is a background process that talks only over stdio pipes. Built as a
 *                    console app it pops a terminal window every time the window-less packaged studio
 *                    spawns it. GUI subsystem = no console is ever allocated; the parent-provided
 *                    stdin/stdout pipes still work (they are handles, independent of the console).
 *   resource.syso  : picked up automatically by `go build`; carries the icon + version metadata so the
 *                    Windows "unknown publisher" prompt shows "Hoplight Remote Access", not "sidecar".
 * TS_NO_LOGS_NO_SUPPORT disables tsnet telemetry.
 */
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const out = isWindows ? "sidecar.exe" : "sidecar";
// -H windowsgui only means anything for a Windows PE target; omit it elsewhere.
const ldflags = isWindows ? ["-ldflags", "-H windowsgui"] : [];

const here = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const args = ["build", ...ldflags, "-o", out, "."];
console.log(`go ${args.join(" ")}  (cwd: ${here})`);

const res = spawnSync("go", args, {
  cwd: here,
  stdio: "inherit",
  env: { ...process.env, TS_NO_LOGS_NO_SUPPORT: "true" },
});
if (res.status !== 0) {
  console.error("sidecar build failed");
  process.exit(res.status ?? 1);
}
console.log(`built ${out}`);
