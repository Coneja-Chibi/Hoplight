/** Parses a small, fail-closed hash route used to open a packaged app and optional inner section. */
export interface LaunchTarget {
  appId: string;
  sectionId?: string;
}

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** `#settings/remote-access` becomes a target; malformed or extra-segment hashes are ignored. */
export function parseLaunchTarget(hash: string): LaunchTarget | null {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !SAFE_ID.test(part))) {
    return null;
  }
  return {
    appId: parts[0]!,
    ...(parts[1] ? { sectionId: parts[1] } : {}),
  };
}
