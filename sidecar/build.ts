/**
 * Build the Hoplight remote-access sidecar.
 *
 *   bun sidecar/build.ts                      -> this machine's own platform, as `sidecar[.exe]`
 *   bun sidecar/build.ts --target=windows-x64 -> a named release asset, `sidecar-windows-x64.exe`
 *
 * The recipe is not optional decoration, two flags each fix a real, already-shipped bug:
 *   -H=windowsgui  : the sidecar is a background process that talks only over stdio pipes. Built as a
 *                    console app it pops a terminal window every time the window-less packaged studio
 *                    spawns it. GUI subsystem = no console is ever allocated; the parent-provided
 *                    stdin/stdout pipes still work (they are handles, independent of the console).
 *   resource.syso  : picked up automatically by `go build`; carries the icon + version metadata so the
 *                    Windows "unknown publisher" prompt shows "Hoplight Remote Access", not "sidecar".
 * TS_NO_LOGS_NO_SUPPORT disables tsnet telemetry.
 *
 * CROSS-COMPILING. --target sets GOOS/GOARCH with CGO_ENABLED=0, which is what makes one runner able to
 * produce the aux-package assets for its whole platform family. The bare `resource.syso` is left alone
 * deliberately: CI already builds this package on ubuntu with that file present and passes, so it does
 * not break a non-Windows link, and renaming it risks the Windows icon for a problem the evidence says
 * we do not have.
 */
import { spawnSync } from "node:child_process";
import { resolveTarget, SIDECAR_TARGETS } from "./build-targets";

const requested = process.argv.find((a) => a.startsWith("--target="))?.split("=")[1];
const target = requested ? resolveTarget(requested) : null;
if (requested && !target) {
  console.error(
    `sidecar build: unknown --target "${requested}"; expected one of ${Object.keys(SIDECAR_TARGETS).join(", ")}`,
  );
  process.exit(2);
}
const spec = target ? SIDECAR_TARGETS[target] : null;

// No --target keeps the historical behaviour exactly: this machine's platform, the plain filename the
// from-source resolver looks for.
const forWindows = spec ? spec.goos === "windows" : process.platform === "win32";
const out = spec ? spec.asset : forWindows ? "sidecar.exe" : "sidecar";
// -H windowsgui only means anything for a Windows PE target; omit it elsewhere.
const ldflags = forWindows ? ["-ldflags", "-H windowsgui"] : [];

const here = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const args = ["build", ...ldflags, "-o", out, "."];
console.log(`go ${args.join(" ")}  (cwd: ${here}${spec ? `, ${spec.goos}/${spec.goarch}` : ""})`);

const res = spawnSync("go", args, {
  cwd: here,
  stdio: "inherit",
  env: {
    ...process.env,
    TS_NO_LOGS_NO_SUPPORT: "true",
    // Pure Go, so a cross build needs no toolchain for the target. Explicit rather than inherited: a
    // runner with CGO on would produce a binary that only runs where it was built.
    ...(spec ? { GOOS: spec.goos, GOARCH: spec.goarch, CGO_ENABLED: "0" } : {}),
  },
});
if (res.status !== 0) {
  console.error("sidecar build failed");
  process.exit(res.status ?? 1);
}
console.log(`built ${out}`);
