/**
 * Reading a release's SHA256SUMS into helper pins, and writing the committed pins module.
 *
 * Its own module so it can be TESTED without the network. A mistake here does not fail loudly: it writes a
 * pin that no downloadable file matches, and the only symptom is a button that refuses for every user.
 */
import { SIDECAR_TARGETS } from "../sidecar/build-targets";

export interface SidecarPinEntry {
  readonly asset: string;
  readonly sha256: string;
  readonly tag: string;
}

/** `<64 hex>  <filename>` - the sha256sum output format, one or more spaces, optional binary-mode star. */
const LINE = /^([0-9a-f]{64})\s+\*?(\S+)$/;

/**
 * Extract the helper pins from a SHA256SUMS body.
 *
 * Only the assets named in SIDECAR_TARGETS are taken; every other line in the file (the app, the CLIs, Kit)
 * is ignored rather than pinned, so this cannot be talked into pinning an arbitrary file by editing the
 * checksum list. Unparseable lines are skipped: the file also carries the binaries we do not pin, and one
 * odd line must not abort a legitimate pin.
 */
export function pinsFromChecksums(body: string, tag: string): Record<string, SidecarPinEntry> {
  const wanted = new Map(Object.entries(SIDECAR_TARGETS).map(([key, spec]) => [spec.asset, key]));
  const pins: Record<string, SidecarPinEntry> = {};
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = LINE.exec(line);
    if (!m) continue;
    const [, sha256, file] = m;
    const key = wanted.get(file!);
    if (!key) continue;
    if (pins[key]) {
      // Two digests for one asset means the checksum file is not a record of one release. Refuse rather
      // than pick, because picking would be arbitrary and one of the two is wrong.
      throw new Error(`SHA256SUMS lists ${file} more than once`);
    }
    pins[key] = { asset: file!, sha256: sha256!, tag };
  }
  return pins;
}

/** The committed pins module. Hand-readable on purpose: it is reviewed, not generated-and-ignored. */
export function sidecarPinsModule(
  pins: Record<string, SidecarPinEntry>,
  repo: string,
  tag: string,
): string {
  const entries = Object.entries(pins)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, pin]) =>
        `  ${JSON.stringify(key)}: {\n` +
        `    asset: ${JSON.stringify(pin.asset)},\n` +
        `    sha256: ${JSON.stringify(pin.sha256)},\n` +
        `    tag: ${JSON.stringify(pin.tag)},\n` +
        `  },`,
    )
    .join("\n");
  return `/**
 * The remote-access helper, pinned like a dependency.
 *
 * WHY COMMITTED RATHER THAN BAKED AT BUILD TIME. Computing each hash during the release build meant only a
 * CI-built binary carried one: a source checkout got nothing, so the download button existed for packaged
 * users and silently did not for everyone else. Committing the pin makes the answer the same everywhere -
 * source, CLI, packaged app - because the trust anchor travels with the repository, not with one build.
 *
 * THE HELPER IS NOT TIED TO AN APP VERSION, which is what makes a single pin serviceable indefinitely. It is
 * a separate process speaking one small stdio protocol (see sidecar-status.ts), so a ${tag} helper works
 * with a much later studio. The coupling is to the PROTOCOL, not the version number, and a protocol change
 * is exactly when bumping this should be a deliberate, reviewed act.
 *
 * WRITTEN BY \`bun scripts/pin-sidecar.ts <tag>\`, which reads the release's published SHA256SUMS and
 * re-downloads each asset to confirm it matches before writing. Review the diff like any other lockfile
 * change: these hashes are the only thing standing between a download and an executed binary.
 */
import type { SidecarPins } from "./aux-download";

/** The repository the pinned assets are published from. */
export const SIDECAR_REPO = ${JSON.stringify(repo)};

/** Pinned helpers, keyed by \`\${process.platform}-\${process.arch}\`. */
export const SIDECAR_PINS: SidecarPins = {
${entries}
};
`;
}
