/**
 * The aux-package download: fetching the remote-access helper binary on demand, verified against a hash
 * baked into this build.
 *
 * WHY THIS EXISTS. The helper is ~31 MB of Go. Embedding it in every Hoplight.exe would add that to a
 * download most people never enable, and shipping it beside the exe would end the one-file install. So it
 * is a release asset the user fetches with an explicit click, once.
 *
 * THIS IS A DOWNLOAD-AND-EXECUTE PATH, and it is treated as one.
 *
 *   - The SHA-256 PIN is the integrity control, and it is baked at build time from the exact file the
 *     release uploads. Bytes that do not match the pin are discarded and never reach the disk path the
 *     spawner reads. The host allowlist below is defence in depth, NOT the guarantee: if GitHub changes
 *     its asset host tomorrow, this loses availability and keeps integrity, which is the correct way
 *     round.
 *   - Nothing is fetched at boot. Only an explicit host-only request starts this.
 *   - Verification happens on BYTES IN MEMORY, before anything is written to the final path, so an
 *     interrupted or tampered download can never leave a runnable file behind.
 *   - HTTPS only, and a redirect may not downgrade or wander off GitHub. A GitHub release download
 *     genuinely does redirect once, from github.com to a signed, time-limited asset host, so following
 *     exactly that hop is required rather than optional.
 *
 * Kept separate from providers/egress.ts on purpose. That gate locks Kit to ONE model-provider host and
 * refuses every cross-host redirect by design; this needs a different, equally narrow rule, and widening
 * the provider gate to fit would weaken it for its real job.
 */
import { createHash } from "node:crypto";

/** Where the helper for one platform lives, and what it must hash to. Baked by the release build. */
export interface SidecarPin {
  /** release asset filename, e.g. "sidecar-windows-x64.exe" */
  readonly asset: string;
  /** lowercase hex SHA-256 of that exact file */
  readonly sha256: string;
  /** the release tag the asset belongs to, e.g. "v0.1.26" */
  readonly tag: string;
}

/** Pins for every platform a helper is published for, keyed by `${process.platform}-${process.arch}`. */
export type SidecarPins = Readonly<Record<string, SidecarPin>>;

/** The key this running process would look itself up by. */
export const platformKey = (): string => `${process.platform}-${process.arch}`;

const START_HOST = "github.com";
/** GitHub serves release bytes off a signed subdomain; it has been renamed before, so match the family. */
const ASSET_HOST_SUFFIX = ".githubusercontent.com";
const MAX_REDIRECTS = 3;
/** The helper is ~31 MB. A cap well above that and far below "fills the disk" bounds a hostile response. */
export const MAX_AUX_BYTES = 96 * 1024 * 1024;

export type AuxFailure =
  | "bad-pin"
  | "insecure-url"
  | "wrong-host"
  | "too-many-redirects"
  | "http-error"
  | "too-large"
  | "hash-mismatch";

/** A refusal with a machine-readable reason, so callers can phrase it without parsing prose. */
export class AuxDownloadError extends Error {
  constructor(
    readonly reason: AuxFailure,
    message: string,
  ) {
    super(message);
    this.name = "AuxDownloadError";
  }
}

const HEX64 = /^[0-9a-f]{64}$/;
/** Conservative: a release tag and an asset name become URL path segments, so no separators, no dots-up. */
const TAG = /^[A-Za-z0-9._-]+$/;
const ASSET = /^[A-Za-z0-9._-]+$/;
const REPO = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * Build the stable download URL for a pinned asset. Validates every interpolated part rather than
 * trusting the generated pins module: a bad tag would otherwise be a path-traversal shaped string
 * pointing this fetcher at some other file in the release.
 */
export function auxAssetUrl(repo: string, pin: SidecarPin): string {
  if (!REPO.test(repo)) throw new AuxDownloadError("bad-pin", `refused repository "${repo}"`);
  if (!TAG.test(pin.tag)) throw new AuxDownloadError("bad-pin", `refused release tag "${pin.tag}"`);
  if (!ASSET.test(pin.asset)) throw new AuxDownloadError("bad-pin", `refused asset name "${pin.asset}"`);
  if (!HEX64.test(pin.sha256)) throw new AuxDownloadError("bad-pin", "pin is not a SHA-256 hex digest");
  return `https://${START_HOST}/${repo}/releases/download/${pin.tag}/${pin.asset}`;
}

/**
 * Gate one hop. The first must be GitHub itself; a redirect may only land on GitHub's asset family, and
 * never on plain http.
 */
export function assertAuxDestination(raw: string, hop: number): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuxDownloadError("insecure-url", `refused unparseable download URL`);
  }
  if (url.protocol !== "https:") {
    throw new AuxDownloadError("insecure-url", `refused ${url.protocol} download; HTTPS only`);
  }
  const ok =
    hop === 0
      ? url.host === START_HOST
      : url.host === START_HOST || url.host.endsWith(ASSET_HOST_SUFFIX);
  if (!ok) {
    throw new AuxDownloadError("wrong-host", `refused to fetch the helper from ${url.host}`);
  }
  return url;
}

export const sha256Hex = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Redirect codes worth following for a plain asset GET. */
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

/**
 * Read a body with a running total, stopping the moment the cap is passed rather than after the fact.
 * Cancels the stream on refusal so a hostile responder does not keep sending into a discarded buffer.
 */
async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        throw new AuxDownloadError("too-large", "the helper download is larger than expected");
      }
      chunks.push(value);
    }
  } finally {
    // Releases the connection on the refusal path; a no-op once the stream has finished normally.
    await reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/**
 * Fetch the pinned asset and return its bytes, or throw. Follows GitHub's one asset redirect by hand
 * (`redirect: "manual"`) rather than letting fetch do it silently, because the whole point is to inspect
 * every hop instead of trusting wherever we land.
 *
 * Returns bytes; it does NOT write them. Keeping the write in the caller means a verification failure
 * cannot possibly leave a file behind, because at that point no file has been opened.
 */
export async function fetchPinnedAux(
  repo: string,
  pin: SidecarPin,
  fetchImpl: FetchLike = fetch,
): Promise<Uint8Array> {
  let target = auxAssetUrl(repo, pin);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = assertAuxDestination(target, hop);
    const res = await fetchImpl(url.href, { redirect: "manual" });

    if (REDIRECTS.has(res.status)) {
      const next = res.headers.get("location");
      if (!next) throw new AuxDownloadError("http-error", `redirect ${res.status} carried no location`);
      // Resolved against the current URL so a relative Location cannot smuggle in a host change.
      target = new URL(next, url).href;
      continue;
    }
    if (!res.ok) {
      throw new AuxDownloadError("http-error", `the download failed with status ${res.status}`);
    }

    // Cheap pre-check on the advertised length, so an honest oversized response costs us no transfer.
    const advertised = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(advertised) && advertised > MAX_AUX_BYTES) {
      throw new AuxDownloadError("too-large", "the helper download is larger than expected");
    }
    // Then the real bound, applied WHILE reading. Checking byteLength after arrayBuffer() would have
    // buffered the whole response first, so a missing or understated Content-Length would already have
    // cost us the memory the cap exists to protect.
    const bytes = await readCapped(res, MAX_AUX_BYTES);

    const got = sha256Hex(bytes);
    if (got !== pin.sha256) {
      // Names both digests: the actionable case is a stale pin after a re-release, and a report that
      // says only "mismatch" cannot tell that apart from tampering.
      throw new AuxDownloadError(
        "hash-mismatch",
        `the downloaded helper did not match its expected fingerprint (expected ${pin.sha256}, got ${got})`,
      );
    }
    return bytes;
  }
  throw new AuxDownloadError("too-many-redirects", "the download redirected too many times");
}
