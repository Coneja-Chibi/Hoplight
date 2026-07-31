/**
 * The platforms the remote-access helper is published for, and the asset name each one ships under.
 *
 * Its OWN module, with no side effects, because two very different callers need this table: build.ts
 * (which runs `go build` when imported) and scripts/build-desktop.ts (which hashes the built assets to
 * bake their pins). Importing the table from build.ts would run a Go build as a side effect of asking
 * what the targets are.
 *
 * The keys are `${process.platform}-${process.arch}` as Node reports them, because that is exactly how a
 * running Hoplight looks its own helper up in the baked pins (see aux-download.ts platformKey).
 */
export const SIDECAR_TARGETS = {
  "win32-x64": { goos: "windows", goarch: "amd64", asset: "sidecar-windows-x64.exe" },
  "linux-x64": { goos: "linux", goarch: "amd64", asset: "sidecar-linux-x64" },
  "linux-arm64": { goos: "linux", goarch: "arm64", asset: "sidecar-linux-arm64" },
  "darwin-arm64": { goos: "darwin", goarch: "arm64", asset: "sidecar-darwin-arm64" },
  "darwin-x64": { goos: "darwin", goarch: "amd64", asset: "sidecar-darwin-x64" },
} as const;

export type SidecarTarget = keyof typeof SIDECAR_TARGETS;

/** Accepted on the command line: friendlier than "win32-x64" for the Windows build. */
export const TARGET_ALIASES: Record<string, SidecarTarget> = {
  "windows-x64": "win32-x64",
};

/** Resolve a --target value to a key of SIDECAR_TARGETS, or null when it names nothing. */
export function resolveTarget(name: string): SidecarTarget | null {
  if (name in SIDECAR_TARGETS) return name as SidecarTarget;
  return TARGET_ALIASES[name] ?? null;
}
