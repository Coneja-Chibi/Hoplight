/**
 * Pin the remote-access helper to a published release.
 *
 *   bun scripts/pin-sidecar.ts v0.1.27
 *
 * Reads that release's published SHA256SUMS, takes the digests of the five helper assets, and rewrites
 * src/ui/remote/sidecar-pins.ts. Commit the result; review it like a lockfile bump, because those hashes
 * are the only thing between a download and an executed binary.
 *
 * WHY THE PUBLISHED CHECKSUMS AND NOT A LOCAL BUILD. Go output is not byte-identical between builds, so a
 * hash taken from a helper compiled on this machine would pin a file nobody can download. The release's own
 * SHA256SUMS is the record of what was actually published, which is the only thing a user's copy will ever
 * receive.
 *
 * The digests are cross-checked against the assets themselves rather than trusted from the checksum file
 * alone - see verifyAgainstAssets. A SHA256SUMS that disagreed with its own release would otherwise be
 * copied straight into the pin.
 */
import { SIDECAR_TARGETS } from "../sidecar/build-targets";
import type { SidecarPinEntry } from "./sidecar-pin-format";
import { pinsFromChecksums, sidecarPinsModule } from "./sidecar-pin-format";

const tag = process.argv[2];
if (!tag || !/^[A-Za-z0-9._-]+$/.test(tag)) {
  console.error("usage: bun scripts/pin-sidecar.ts <tag>    e.g. v0.1.27");
  process.exit(2);
}

const repo = "Coneja-Chibi/Hoplight";
const base = `https://github.com/${repo}/releases/download/${tag}`;

console.log(`reading ${base}/SHA256SUMS`);
const res = await fetch(`${base}/SHA256SUMS`, { redirect: "follow" });
if (!res.ok) {
  console.error(`could not read SHA256SUMS for ${tag} (status ${res.status})`);
  process.exit(1);
}
const pins = pinsFromChecksums(await res.text(), tag);

const found = Object.keys(pins);
if (found.length === 0) {
  console.error(
    `${tag} publishes no helper assets. Release once with the helpers built, then pin that tag.`,
  );
  process.exit(1);
}

/**
 * Download each pinned asset and confirm it really hashes to what SHA256SUMS claimed. The checksum file and
 * the assets are published by the same job, so a disagreement means something is wrong with the release -
 * and pinning a digest that no downloadable file matches would refuse the download for every user, forever,
 * with the failure surfacing only when someone pressed the button.
 */
async function verifyAgainstAssets(entries: Record<string, SidecarPinEntry>): Promise<void> {
  for (const [key, pin] of Object.entries(entries)) {
    const asset = await fetch(`${base}/${pin.asset}`, { redirect: "follow" });
    if (!asset.ok) throw new Error(`${pin.asset} is listed in SHA256SUMS but not downloadable`);
    const bytes = new Uint8Array(await asset.arrayBuffer());
    const got = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
    if (got !== pin.sha256) {
      throw new Error(`${pin.asset} hashes to ${got} but SHA256SUMS says ${pin.sha256}`);
    }
    console.log(`  verified ${key} -> ${pin.asset} (${(bytes.byteLength / 1e6).toFixed(1)} MB)`);
  }
}

await verifyAgainstAssets(pins);

const missing = Object.keys(SIDECAR_TARGETS).filter((k) => !(k in pins));
if (missing.length) {
  // Named rather than silently accepted: those platforms will report no download available.
  console.log(`note: no helper published for ${missing.join(", ")}; they will offer no download`);
}

const path = new URL("../src/ui/remote/sidecar-pins.ts", import.meta.url);
await Bun.write(path, sidecarPinsModule(pins, repo, tag));
console.log(`pinned ${found.length} helper(s) from ${tag}: ${found.join(", ")}`);
console.log("review the diff and commit it; this is a trust decision, not a generated artifact.");
