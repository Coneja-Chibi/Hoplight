/**
 * The remote-access helper, pinned like a dependency.
 *
 * WHY COMMITTED RATHER THAN BAKED AT BUILD TIME. The first version of this computed each hash during the
 * release build, which meant only a CI-built binary carried one: a source checkout got nothing, so the
 * download button existed for packaged users and silently did not for everyone else. Committing the pin
 * makes the answer the same everywhere - source, CLI, packaged app - because the trust anchor travels with
 * the repository instead of with one build.
 *
 * THE HELPER IS NOT TIED TO AN APP VERSION, which is what makes a single pin serviceable indefinitely. It
 * is a separate process that speaks one small stdio protocol (see sidecar-status.ts). A v0.1.26 helper
 * works with a v0.2.0 studio. So this points at one known-good release and stays there until we choose to
 * move it - the coupling is to the PROTOCOL, not the version number, and a protocol change is exactly when
 * bumping this is a deliberate, reviewed act.
 *
 * TO UPDATE: `bun scripts/pin-sidecar.ts <tag>` reads that release's published SHA256SUMS and rewrites this
 * file. Review the diff like any other lockfile change - these hashes are the only thing standing between a
 * download and an executed binary.
 *
 * An EMPTY map is valid and means "no helper download is offered", which is what every platform reports
 * until a release has published helpers and someone has pinned them.
 */
import type { SidecarPins } from "./aux-download";

/** The repository the pinned assets are published from. */
export const SIDECAR_REPO = "Coneja-Chibi/Hoplight";

/**
 * Pinned helpers, keyed by `${process.platform}-${process.arch}`.
 *
 * Empty pending the first release that publishes helper assets: a pin has to name a file that exists, and
 * hashing a local build would pin something no user can download. Run the script above after that release.
 */
export const SIDECAR_PINS: SidecarPins = {};
