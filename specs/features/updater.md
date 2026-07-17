# Spec: The Updater

**Package:** `apps/cli` (command surface) + `packages/core` (shared verify/version-compare
primitives, consumed later by `apps/studio` in M6) · **Milestone:** M1 · **Status:** draft
**Depends on:** specs/formats/escrow-and-roundtrip.md (none directly; referenced only for
report-style conventions), docs/03-CONVENTIONS.md (CLI conventions) · **VAUDEVILLE
reference:** none (VAUDEVILLE is a web app with no self-update mechanism; this is a
new build informed by ADR-003 only)

## Purpose

The updater keeps a `vaud` single-file executable current without requiring package
managers, installers, or a running Node/git toolchain, per ADR-003. It checks GitHub
Releases for a newer version, verifies the downloaded binary against a signed
checksum file, and atomically replaces the currently running executable in place,
on all three supported OS targets (Windows x64, macOS arm64/x64, Linux x64). It
never installs anything without the user's explicit consent, and it fails closed:
any verification failure aborts the swap and leaves the existing binary untouched.

## Behavior

### Release channel and artifact layout

Releases are published to GitHub Releases on the product's repository. Each tagged
release (`vX.Y.Z`, following semver) attaches:

- One binary per target: `vaud-win-x64.exe`, `vaud-macos-arm64`, `vaud-macos-x64`,
  `vaud-linux-x64` (naming exact strings are an M1 release-CI ticket concern; the
  updater must treat the target identifier as a stable enum
  `WindowsX64 | MacArm64 | MacX64 | LinuxX64` resolved from `process.platform` +
  `process.arch` at runtime).
- One `checksums.txt` file: newline-separated `<sha256-hex>  <filename>` pairs (the
  standard `sha256sum` output format), covering every binary in the release.
- One `checksums.txt.minisig` file: a minisign detached signature over
  `checksums.txt`, produced with the project's release signing key. The corresponding
  public key ships embedded in the `vaud` binary itself (compiled in as a constant,
  not fetched at runtime) so a compromised GitHub account cannot silently swap the
  trust root along with the artifacts.

GitHub's release API is reached read-only, over HTTPS, at
`https://api.github.com/repos/<owner>/<repo>/releases/latest` (or
`/releases` for a channel other than stable: see below). This is the only network
endpoint the updater ever calls, matching the security invariant in
`docs/02-ARCHITECTURE.md` ("No network calls except: model providers the user
configured, and the updater hitting GitHub Releases, checksum-verified").

### Release channels

Two channels, both driven by GitHub Release metadata, no separate channel server:

- **stable** (default): the release marked `latest` (not a GitHub prerelease) with
  the highest semver tag.
- **beta**: opted in via `vaud upgrade --channel beta` or a persisted config value
  (`~/.vaud/config.json` per `docs/03-CONVENTIONS.md` CLI conventions and
  `cli-ux.md`); includes GitHub prereleases (tags with a semver prerelease suffix,
  e.g. `v0.2.0-beta.1`). Channel selection is sticky across runs once set via config;
  `--channel` on a single invocation does not persist unless combined with
  `--save`.

Version comparison uses standard semver precedence (semver.org section 11): a
release is "newer" only if its parsed semver is strictly greater than the running
binary's embedded version under the selected channel's prerelease-inclusion rule.

### Version check etiquette

- **Frequency cap:** at most one remote check per 24 hours, regardless of how many
  `vaud` invocations happen in that window. The last-checked timestamp persists in
  `~/.vaud/config.json` (or platform config dir equivalent: see `cli-ux.md`) under
  an `updater.lastCheckedAt` ISO-8601 field. Any command that would trigger an
  implicit check (see below) first reads this field; if `now - lastCheckedAt < 24h`,
  it skips the network call entirely.
- **Non-blocking:** the implicit check (run opportunistically on ordinary command
  invocations, not just `vaud upgrade`) never delays command output. It is fired
  with a short timeout (recommend 2000ms) and its result is only ever used to print
  a one-line notice AFTER the command's real output, on stderr, never stdout (so
  `--json` and pipe consumers are unaffected). If the check has not completed by the
  time the command would exit, the process exits without waiting for it (fire-and-
  forget; the check result for that run is simply discarded, not cached as a miss).
- **No implicit check when:** `--json` is passed to the running command (machine
  consumers should see nothing extra), `VAUD_NO_UPDATE_CHECK` env var is set, the
  running command IS `vaud upgrade` itself (that command always does its own
  explicit, blocking check), or stdout is not a TTY and the command is not
  `vaud upgrade` (scripted/CI usage should be silent by default).
- **Never auto-install.** The implicit check only ever prints
  `a new version of vaud is available: run "vaud upgrade" to install vX.Y.Z`
  (plain vocabulary per `docs/03-CONVENTIONS.md`). Installing always requires the
  user to run `vaud upgrade` (or pass `--yes` to skip its confirmation prompt, per
  the CLI conventions' "destructive operations require --yes or interactive
  confirmation" rule: replacing the running binary is treated as destructive).

### `vaud upgrade` command flow

1. Resolve the target channel (flag > persisted config > default `stable`).
2. Fetch the release list/latest release from the GitHub API. Determine the newest
   eligible release for the channel. If it is not newer than the running version,
   print `vaud is up to date (vX.Y.Z)` and exit 0. `--force` bypasses the
   version-newer check and reinstalls the resolved release even if it matches the
   running version (for repairing a corrupted local binary).
3. Print the target version and a short changelog excerpt (GitHub release body,
   truncated) and prompt for confirmation unless `--yes` was passed or stdout is
   not a TTY (in which case `--yes` is required; a non-interactive session without
   `--yes` exits 1 with a message explaining it needs one or the other).
4. Resolve the download URLs for the binary matching the current OS/arch target,
   `checksums.txt`, and `checksums.txt.minisig` from the release's asset list.
5. Download `checksums.txt` and `checksums.txt.minisig` fully into memory (both are
   small, KB-scale).
6. **Signature verification (must pass before anything else proceeds):** verify
   `checksums.txt.minisig` against `checksums.txt` using the embedded minisign
   public key. See "Verification algorithm" below for the exact byte-level steps.
   On failure: abort immediately, exit 2, print an error naming the release and
   instructing the user to report it (a signature failure on official infrastructure
   is a security incident, not a retry-and-hope situation) and DO NOT fall back to
   an unverified path.
7. Parse `checksums.txt`, locate the line for this target's binary filename, extract
   its expected SHA-256 hex digest.
8. Download the target binary to a temp file inside the same directory as the
   current executable (same-filesystem requirement so the final rename is atomic:
   see "Atomic self-swap" below), streaming to disk.
9. Compute SHA-256 of the downloaded temp file. Compare (case-insensitive hex
   compare) against the expected digest from step 7. Mismatch: delete the temp
   file, abort, exit 2, print an error. Do not attempt the swap.
10. Set the executable bit on the temp file (macOS/Linux only; no-op on Windows).
11. Perform the atomic self-swap (below).
12. Print `updated to vX.Y.Z` and exit 0. Update `updater.lastCheckedAt` and
    `updater.lastKnownVersion` in config.

### Atomic self-swap

The running process cannot simply overwrite its own executable file in place while
executing from it, and the mechanism differs meaningfully by OS:

**macOS and Linux:** the OS allows unlinking (deleting) a file that is currently
mapped/executing; the inode stays alive until the last open handle (including the
kernel's mapped-image handle) closes. So the swap is a single `rename(2)` of the
verified temp file onto the current executable's path. `rename` within the same
filesystem is atomic: readers either see the old inode or the new one, never a
partial file. Sequence: `fs.rename(tempPath, currentExePath)`. If this fails (e.g.
cross-device: should not happen since the temp file is created in the same
directory in step 8), abort with exit 2 and leave the temp file for inspection
rather than deleting it silently.

**Windows:** the OS holds an exclusive lock on the image backing a running process's
`.exe` (and any DLL it has mapped): the file cannot be deleted or overwritten while
the process holding the mapping is alive, even by that same process, without
`FILE_SHARE_DELETE` semantics that Node/Bun's default file handles do not use for
their own image. The rename dance:

1. Rename the CURRENTLY RUNNING executable (`vaud.exe`) to a sibling path,
   `vaud.exe.old-<pid>` , in the same directory. Renaming an in-use file IS
   permitted on Windows (unlike deleting or overwriting) because rename only
   touches the directory entry, not the file's open handles.
2. Rename the verified temp file to the original path, `vaud.exe`.
3. Spawn a detached cleanup: the newly placed `vaud.exe` (on its very next
   invocation, or via a short-lived detached helper process spawned at the end of
   this `upgrade` run) deletes `vaud.exe.old-<pid>` once the old process has exited
   and released its lock. Practically: at the top of `vaud`'s startup, before any
   other work, scan the executable's directory for `vaud.exe.old-*` files and
   attempt to delete each; a locked one (rare: overlapping upgrade) is silently
   skipped and retried on the next startup. This makes cleanup self-healing without
   needing a scheduled task or a blocking wait in the upgrade command itself.
4. The `upgrade` command process itself is still running from the now-renamed
   `.old-<pid>` file's memory-mapped image; this is fine, the OS keeps it alive
   until process exit, exactly like the macOS/Linux case: only the DIRECTORY ENTRY
   moved, not the bytes. The process exits normally after printing the success
   message.

**Rollback on failed verify:** because the swap (steps in "Atomic self-swap") only
ever runs after checksum verification (step 9) succeeds, "rollback" for a failed
verify is simply "never attempted the swap": steps 6 and 9 are hard gates before
any file at the current executable's path is touched. There is no partially-applied
state to roll back from a verify failure. The one recovery case that DOES need
explicit handling is a crash or kill between the Windows rename dance's step 1 and
step 2 (executable briefly absent under its real name): on next startup, if
`vaud.exe` is missing but exactly one `vaud.exe.old-<pid>` and one leftover verified
temp file are found, the startup path completes the pending rename before doing
anything else. If ambiguous (multiple candidates, or the temp file's checksum no
longer matches a known-good record), leave it alone and surface a warning; do not
guess.

### Verification algorithm (minisign)

Format reference: minisign detached signatures (`.minisig`) are four text lines:

```
untrusted comment: <free text, attacker-modifiable, ignored for trust decisions>
base64( sig_alg(2 bytes) || key_id(8 bytes) || signature(64 bytes) )
trusted comment: <free text, covered by the global signature>
base64( global_signature(64 bytes) )
```

`sig_alg` is the ASCII bytes `Ed` for the legacy (direct Ed25519-over-file) mode or
`ED` for the prehashed (Ed25519ph, BLAKE2b-512 digest signed) mode; the release
tooling controls which mode is produced (`minisign -H` for prehashed): the updater
must support whichever mode the release CI actually emits and MUST reject a
signature whose `sig_alg` does not match one of these two known values.

Public key file / embedded constant: `base64( sig_alg(2 bytes) || key_id(8 bytes) ||
public_key(32 bytes, Ed25519) )`. The updater embeds only the raw 32-byte Ed25519
public key (and its 8-byte key_id, to reject signatures from a rotated/different
key) as a compiled-in constant; it does not parse a `.pub` file at runtime.

Verification steps:

1. Parse the four lines. Base64-decode line 2 into `sig_alg || key_id || signature`.
   Confirm `key_id` matches the embedded public key's `key_id`; mismatch is a hard
   failure (signed by a different, untrusted key).
2. Compute the message that `signature` covers: if `sig_alg == "Ed"`, the message is
   the raw bytes of `checksums.txt`. If `sig_alg == "ED"`, the message is
   BLAKE2b-512(`checksums.txt` bytes).
3. Verify `signature` is a valid Ed25519 signature of that message under the
   embedded public key. Failure aborts (see step 6 in the upgrade flow).
4. Base64-decode line 4 into `global_signature` (64 bytes).
5. Compute `global_message = signature_bytes(64) || trusted_comment_line_bytes`
   (the trusted comment line's raw UTF-8 bytes, matching minisign's own
   construction: the comment as it appears after the `trusted comment: ` prefix).
6. Verify `global_signature` is a valid Ed25519 signature of `global_message` under
   the same embedded public key. This binds the trusted comment (which upstream
   minisign uses for metadata like intended filename/timestamp, preventing a valid
   old signature from being replayed under a new name) to the file signature.
   Failure aborts.
7. Only if both step 3 and step 6 pass is `checksums.txt` considered authentic.

OPEN QUESTION: which Ed25519/BLAKE2b library the implementation uses (pure-JS
via a package such as `@noble/ed25519` + `@noble/hashes`, vs. Bun's built-in
`node:crypto` where available, vs. shelling out to a bundled `minisign` binary).
Bun's `node:crypto` does not currently expose Ed25519 verify with a raw 32-byte key
in a way that avoids DER wrapping without extra work; this needs a spike ticket
before implementation. Pick whichever keeps `packages/core` dependency-light
(ADR-001) and works identically under Bun and Node.

OPEN QUESTION: exact repository owner/name for the GitHub Releases API path, and
whether the release-CI ticket names binaries exactly as assumed above
(`vaud-<os>-<arch>[.exe]`): this spec assumes that naming as the simplest
convention; the release-CI ticket is the source of truth and must either match this
or this spec must be updated to match it.

### Failure and offline behavior

- Network unreachable (DNS/connect failure) during an implicit check: silently
  skip (no error printed; this is expected on offline machines and must not be
  noisy). During an explicit `vaud upgrade`: print a plain network-error message
  and exit 2.
- GitHub API rate limit (unauthenticated: 60 requests/hour per IP) hit: treat as a
  transient failure identical to network unreachable. The 24-hour cap on implicit
  checks keeps this extremely unlikely to matter in practice; `vaud upgrade` run
  repeatedly in a short loop could hit it and should say so plainly rather than
  print a generic error.
- Disk full / permission denied writing the temp file or performing the rename:
  exit 2 with the underlying OS error message attached (per `docs/03-CONVENTIONS.md`
  typed error classes with a `userMessage` field).
- Downloaded binary is empty or truncated: caught by the SHA-256 mismatch check
  (step 9); no special-case needed.

## Public API sketch

```ts
// packages/core/src/updater/types.ts

export type UpdateChannel = "stable" | "beta";

export type UpdateTarget =
  | "win-x64"
  | "macos-arm64"
  | "macos-x64"
  | "linux-x64";

export interface UpdaterConfig {
  channel: UpdateChannel;
  lastCheckedAt?: string;      // ISO-8601
  lastKnownVersion?: string;   // last remote version observed
}

export interface ReleaseInfo {
  version: string;             // semver, no leading "v"
  tag: string;                 // raw GitHub tag, e.g. "v0.1.3"
  channel: UpdateChannel;
  prerelease: boolean;
  publishedAt: string;         // ISO-8601
  notes: string;                // release body, unmodified
  assets: ReleaseAsset[];
}

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface CheckResult {
  currentVersion: string;
  latest: ReleaseInfo | null;  // null if check failed or nothing eligible
  updateAvailable: boolean;
}

export class UpdaterError extends Error {
  readonly code:
    | "network"
    | "rate-limited"
    | "signature-invalid"
    | "checksum-mismatch"
    | "no-asset-for-target"
    | "fs-permission"
    | "fs-other";
  readonly userMessage: string;
}

// packages/core/src/updater/checker.ts
export interface UpdateChecker {
  /** Reads persisted config, applies the 24h cap, returns null without a network
   *  call if the cap is still in effect (caller decides whether that's a "no news"
   *  or a genuine skip). */
  checkIfDue(now?: Date): Promise<CheckResult | null>;
  /** Always performs the network call, ignoring the cap. Used by `vaud upgrade`. */
  checkNow(channel: UpdateChannel): Promise<CheckResult>;
}

// packages/core/src/updater/verify.ts
export interface MinisignPublicKey {
  keyId: Uint8Array;   // 8 bytes
  publicKey: Uint8Array; // 32 bytes, Ed25519
}

/** Throws UpdaterError("signature-invalid") on any failure. Resolves with the
 *  verified bytes (== message) on success. Implements the algorithm in
 *  "Verification algorithm" above. */
export function verifyMinisignDetached(
  message: Uint8Array,
  signatureFileText: string,
  trustedKey: MinisignPublicKey,
): Promise<Uint8Array>;

export function sha256Hex(bytes: Uint8Array | ReadableStream): Promise<string>;

// packages/core/src/updater/installer.ts
export interface SwapPlan {
  target: UpdateTarget;
  currentExePath: string;
  verifiedTempPath: string;
}

/** Performs the OS-appropriate atomic swap described under "Atomic self-swap".
 *  Idempotent-safe to call self-healing cleanup separately via
 *  cleanupStaleSwapArtifacts(). */
export function performSwap(plan: SwapPlan): Promise<void>;

/** Called at CLI startup, cheap no-op in the common case. Deletes any
 *  `*.old-<pid>` leftovers whose owning process has exited, and completes an
 *  interrupted Windows rename dance if a consistent pending state is found. */
export function cleanupStaleSwapArtifacts(exeDir: string): Promise<void>;

// apps/cli/src/commands/upgrade.ts
export interface UpgradeOptions {
  channel?: UpdateChannel;
  yes?: boolean;
  force?: boolean;
  save?: boolean;   // persist --channel choice to config
  json?: boolean;
}

export function runUpgradeCommand(options: UpgradeOptions): Promise<number>; // exit code
```

## Edge cases & failure modes

1. **No release exists yet for this OS/arch target** (e.g. a beta tag was published
   without a Linux build). `no-asset-for-target` error; exit 2; message names the
   missing asset and the target.
2. **`vaud upgrade` run from a location the user does not have write access to**
   (e.g. installed into `Program Files` by a different user/admin context on
   Windows, or a root-owned path on Linux without sudo). Fails at the temp-file
   creation step (step 8) with `fs-permission`; message suggests re-running with
   elevated permissions or moving the binary to a user-writable directory: the
   updater does not attempt privilege escalation itself.
3. **Symlinked or hardlinked executable** (user made `vaud` a symlink into a
   different real path, e.g. via a personal `~/bin`). `process.execPath`
   resolution must use the REAL path (`fs.realpath`) before computing
   `currentExePath`/`tempPath`'s directory, so the swap happens on the actual
   binary, not the symlink, and stays same-filesystem with it. If the resolved
   real path's directory is not writable, same as edge case 2.
4. **Two `vaud upgrade` invocations run concurrently** (rare, e.g. two terminals).
   No file lock is taken; the OS-level rename atomicity means whichever finishes
   its rename last "wins" and the loser's temp file is orphaned but harmless (the
   final binary is still a valid, verified one from the release, just possibly not
   the invocation the user is watching). The `vaud.exe.old-<pid>` naming already
   includes the pid specifically so concurrent Windows runs cannot collide on that
   filename. OPEN QUESTION: whether M1 needs an explicit lockfile
   (`~/.vaud/updater.lock`) to make the loser fail fast with a clear message
   instead of silently racing; recommend deferring unless it proves to be a real
   support burden.
5. **Running version is NEWER than the latest release** (a beta/dev build, or a
   channel downgrade from beta to stable where the stable release is older).
   `updateAvailable` is `false`; `vaud upgrade` without `--force` reports
   "vaud is up to date (vX.Y.Z)" and exits 0, matching the "no update" path: it
   never offers to downgrade implicitly. `vaud upgrade --force <specific-version>`
   (explicit version target) is out of scope for M1; note as a possible M2+
   extension, not required now.
6. **`checksums.txt` lists a digest for the target binary but the binary asset is
   missing from the release** (asset upload partially failed on the release CI
   side). Detected at step 4 (asset resolution): `no-asset-for-target`, same as
   edge case 1, even though the checksum entry exists: the updater trusts asset
   presence, not just the checksum list, before attempting a download.
7. **Corrupted local config file** (`~/.vaud/config.json` has invalid JSON or an
   `updater` block failing schema validation). Treated as absent: proceed as if no
   `lastCheckedAt` is recorded (so an implicit check fires), and overwrite the
   corrupted block on next successful write. Never crash a normal command over a
   malformed config file.
8. **User is on a network that blocks GitHub** (corporate proxy, GFW, etc). Same as
   "network unreachable" in Failure and offline behavior; no special detection,
   no retry storm: one attempt per invocation, clear error on `vaud upgrade`.
9. **Downloaded `checksums.txt.minisig` is well-formed but signed by an OLD,
   previously-valid key that has since been rotated out** (key rotation policy is
   not yet defined for this project). Because the updater embeds exactly one public
   key per compiled binary (the key current as of that binary's own release), an
   old binary verifying against a new release signed with a rotated key would see
   `key_id` mismatch and fail closed: which also means key rotation requires users
   to update via SOME path where the transition is signed by both old and new keys,
   or a manual download bridge release. OPEN QUESTION: key rotation procedure; not
   needed for M1 (no rotation has happened yet) but must be designed before the
   first rotation, and this spec should be revisited then.
10. **`vaud upgrade --json` machine output.** Must emit a single JSON object to
    stdout on completion (success or handled failure) matching the plain-language
    outcomes above, e.g. `{"status":"updated","version":"0.2.0"}`,
    `{"status":"up-to-date","version":"0.1.3"}`,
    `{"status":"error","code":"checksum-mismatch","message":"..."}`. Logs/progress
    (download percentage, etc.) go to stderr, never stdout, per the CLI
    conventions' `--json` rule.
11. **Interrupted download** (connection drops mid-stream). The partially written
    temp file fails the SHA-256 check at step 9 (short/garbage content); handled by
    the existing checksum-mismatch path, no separate retry logic required for M1.
    OPEN QUESTION: whether M1 should auto-retry the download once before failing;
    recommend yes (single retry, same run) as a small UX improvement but it is not
    load-bearing for correctness, so leaving it to the implementing ticket's
    discretion is acceptable, not blocking.

## Test plan

Because this spec has no fixture corpus (the Round-Trip Law does not apply: there
is no format being parsed/serialized), tests are unit + integration style against
constructed inputs and a fake GitHub API, not the fixture corpus convention used by
codec specs.

- **Fixtures required** (`fixtures/updater/`: new directory, not one of the format
  corpora):
  - `fixtures/updater/checksums-valid.txt` + `checksums-valid.txt.minisig` +
    `updater-test-keypair.pub`/`.sec` (a throwaway minisign keypair generated for
    test purposes only, never the real release key): exercises the full valid
    verify path.
  - `fixtures/updater/checksums-tampered.txt` (one byte changed after signing) +
    the same `.minisig`: must fail verification (step 3 in the algorithm).
  - `fixtures/updater/checksums-wrong-key.minisig` (signed with a different
    throwaway key): must fail on `key_id` mismatch (step 1).
  - `fixtures/updater/checksums-tampered-trusted-comment.txt.minisig` (trusted
    comment line altered post-signing, file signature itself untouched): must fail
    at step 6 (global signature) even though step 3 alone would pass; this is the
    specific case the two-tier minisign format exists to catch and the test suite
    must assert it explicitly, not just assert "verify fails somewhere."
  - `fixtures/updater/sample-release.json`: a captured (redacted) GitHub Releases
    API response shape, used to unit-test channel resolution (stable vs beta,
    semver ordering, prerelease flag handling) without hitting the network.
- **Round-Trip Law applicability:** none. No canonical model, no codec, no escrow.
- **Property/unit tests beyond fixtures:**
  - Semver comparison: table of (current, candidate, channel) -> expected
    `updateAvailable`, including prerelease-vs-release edge cases
    (`0.2.0-beta.1` vs `0.1.9` on stable channel must NOT count as an update on
    the stable channel even though it's semver-greater).
  - 24-hour cap: fake clock, assert no network call is attempted when
    `lastCheckedAt` is inside the window, and that it IS attempted just outside it.
  - `--json` output never touches stdout except the final single JSON object
    (assert against a captured stdout buffer across a full simulated run with a
    fake HTTP layer).
  - Atomic swap on POSIX: integration test using a real temp directory and a real
    (small, fake) "executable" file standing in for the binary; assert the rename
    happens and old inode content is gone from the path but the process (simulated
    by holding an open file handle across the rename) does not error.
  - Windows rename dance: integration test gated to run only on Windows CI runners
    (the mechanism is meaningfully different and cannot be faithfully emulated on
    POSIX); assert `.old-<pid>` appears, then disappears after a simulated
    "next startup" cleanup call, and that a startup call finding a consistent
    interrupted state (missing real exe, one `.old-<pid>`, one leftover verified
    temp file with matching checksum) completes the pending rename.
  - Concurrent-invocation stress test (POSIX): two swap attempts against the same
    target path from two processes; assert the final file at the target path is
    ALWAYS one of the two valid verified binaries, never a corrupt/partial file
    (proves atomicity, not lock-free race avoidance, which per edge case 4 is not
    guaranteed).
  - Rate-limit / network-error paths: mocked HTTP layer returning 403 with
    `X-RateLimit-Remaining: 0` and returning a connection error, asserting the
    correct `UpdaterError.code` and exit code for both implicit and explicit check
    contexts.

## Non-goals

- Package manager manifests (winget/scoop/brew/apt): explicitly deferred in
  ADR-003 ("Later... when someone asks").
- Signed installers via Tauri bundler: that is `apps/studio`'s M6 concern, reusing
  this package's verify primitives but with its own UI-driven flow, not this spec.
- Delta/binary-diff updates (downloading only the changed bytes): full binary
  download every time is accepted for M1 given ADR-003's stated binary-size
  tradeoff; not in scope.
- Code-signing certificates / notarization / SmartScreen reputation: ADR-003
  explicitly defers buying a cert; this spec's job is checksum+signature integrity,
  not OS trust-chain reputation. The "More info -> Run anyway" SmartScreen
  documentation is a separate M1 ticket (see the production bible (private planning notes) M1 ticket
  list: "SmartScreen docs"), not part of the updater's runtime behavior.
- Automatic/silent updates without user consent: explicitly forbidden by ADR-003
  ("never auto-install without consent").
- Downgrading to an older version as an implicit flow: see edge case 5; explicit
  version-pinned installs are a possible future extension, not built here.
- Telemetry about update adoption: forbidden globally by
  docs/02-ARCHITECTURE.md's "No telemetry of any kind" invariant; the updater must
  not phone home anything beyond the unauthenticated, unattributed GitHub Releases
  GET request itself.

## Sources consulted

- `the master plan (private planning notes):36`: distribution/self-updater locked decision.
- `docs/02-ARCHITECTURE.md:87-90`: network-call and telemetry invariants.
- `docs/decisions/ADR-003-distribution.md:1-34`: full distribution decision: single
  executables via `bun build --compile`, GitHub Releases, `vaud upgrade` mechanism,
  SHA-256 + minisign-signed checksums, atomic self-swap, passive check etiquette
  (max one non-blocking notice/day, never auto-install), later installer/package-
  manager plans, SmartScreen note, binary size acceptance.
- `docs/03-CONVENTIONS.md:33-40`: CLI conventions: `--json` stdout/stderr
  separation, exit codes (0/1/2), destructive-op confirmation (`--yes`), plain
  output vocabulary, typed error classes with `userMessage`.
- `the production bible (private planning notes):74,93`: this file's brief (release channel, version
  check etiquette 1/day non-blocking, SHA-256 + minisign verify, atomic self-swap
  Windows rename dance, rollback on failed verify) and the M1 ticket-list line
  confirming "release CI (3-OS binaries + checksums); updater" are sibling M1
  tickets this spec's asset-naming assumptions depend on.
- `templates/SPEC-TEMPLATE.md`: structure followed for this document.
- Minisign file format and verification steps: Frank Denis, "Minisign" project page,
  https://jedisct1.github.io/minisign/ (public key file format: untrusted comment +
  base64(sig_alg || key_id || public_key); secret key format; signature file format:
  untrusted comment line, base64(sig_alg || key_id || signature), trusted comment
  line, base64(global_signature); `Ed` vs `ED` (prehashed, BLAKE2b-512) algorithm
  identifiers).
- Minisign signature/public-key structure corroboration (untrusted vs trusted
  comment semantics, Ed25519 algorithm, `<filename>.minisig` convention): search
  result summaries of https://github.com/jedisct1/minisign and
  https://www.mankier.com/1/minisign, retrieved via web search July 2026.
- GitHub REST API for Releases (`/repos/{owner}/{repo}/releases`,
  `/repos/{owner}/{repo}/releases/latest`) and the standard unauthenticated rate
  limit (60 requests/hour/IP): general public GitHub REST API documentation,
  known/stable behavior, not independently re-fetched in this session: flagged
  here rather than cited to a specific URL because it was not re-verified via
  WebFetch this session. OPEN QUESTION: confirm the exact current rate limit figure
  against https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
  before the implementing ticket ships, in case GitHub has changed it.
- `semver.org` precedence rules (section 11) for version comparison and
  prerelease ordering: standard, well-known specification, not re-fetched this
  session.
