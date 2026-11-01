/**
 * The remote-access helper, pinned like a dependency.
 *
 * WHY COMMITTED RATHER THAN BAKED AT BUILD TIME. Computing each hash during the release build meant only a
 * CI-built binary carried one: a source checkout got nothing, so the download button existed for packaged
 * users and silently did not for everyone else. Committing the pin makes the answer the same everywhere -
 * source, CLI, packaged app - because the trust anchor travels with the repository, not with one build.
 *
 * THE HELPER IS NOT TIED TO AN APP VERSION, which is what makes a single pin serviceable indefinitely. It is
 * a separate process speaking one small stdio protocol (see sidecar-status.ts), so a v0.1.41 helper works
 * with a much later studio. The coupling is to the PROTOCOL, not the version number, and a protocol change
 * is exactly when bumping this should be a deliberate, reviewed act.
 *
 * WRITTEN BY `bun scripts/pin-sidecar.ts <tag>`, which reads the release's published SHA256SUMS and
 * re-downloads each asset to confirm it matches before writing. Review the diff like any other lockfile
 * change: these hashes are the only thing standing between a download and an executed binary.
 */
import type { SidecarPins } from "./aux-download";

/** The repository the pinned assets are published from. */
export const SIDECAR_REPO = "Vaudeville-Studios/Hoplight";

/** Pinned helpers, keyed by `${process.platform}-${process.arch}`. */
export const SIDECAR_PINS: SidecarPins = {
  "darwin-arm64": {
    asset: "sidecar-darwin-arm64",
    sha256: "6aa3667587dab76b869f38ca30e02b6ec5efa2110265fc8fcb38cc08e8c194bb",
    tag: "v0.1.41",
  },
  "darwin-x64": {
    asset: "sidecar-darwin-x64",
    sha256: "4762a0b5cd237e25fe47f7db85d8ccca3377752c2d48a327e4cdc3c49e1b3384",
    tag: "v0.1.41",
  },
  "linux-arm64": {
    asset: "sidecar-linux-arm64",
    sha256: "59c02310546a21328f7d2b3c58254c48278658a003d50518c2865d073787e918",
    tag: "v0.1.41",
  },
  "linux-x64": {
    asset: "sidecar-linux-x64",
    sha256: "389a93149dc443f5259041b757a4776b39d3418553d1906632759fb1ee2e1259",
    tag: "v0.1.41",
  },
  "win32-x64": {
    asset: "sidecar-windows-x64.exe",
    sha256: "7b418fd7cedc0ce749a8e296c5d5f60d931a2f11d62fc9e1d49a653170456d16",
    tag: "v0.1.41",
  },
};
