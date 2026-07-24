/**
 * Pure guards for downloading a packaged release build: which asset matches THIS binary, and whether a
 * download URL points at a trusted GitHub host. Both stand between a version switch and running a fetched
 * executable, so both fail closed. (safeExternalUrl is the general http/https link check; this is the
 * stricter https + GitHub-host allowlist a binary download demands, a distinct concept.)
 */

/**
 * Which release asset matches the running binary. Exact basename match: the desktop app is "Hoplight.exe",
 * the CLIs are "hoplight-<os>-<arch>[.exe]", and each release ships those exact names. No match (a dev
 * `bun` binary, or an arch with no build) -> null, and the caller fails closed to "download manually".
 */
export function resolveAsset(assetNames: readonly string[], execBasename: string): string | null {
  return assetNames.find((n) => n === execBasename) ?? null;
}

/** GitHub hosts a release download may legitimately come from (the asset URL and every redirect hop). */
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "api.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

/** True only for an https URL whose host is a known GitHub release host. Deny by absence. Pure. */
export function isAllowedDownloadHost(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && ALLOWED_DOWNLOAD_HOSTS.has(u.hostname);
}
