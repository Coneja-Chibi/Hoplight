# Plan 003: Run the sidecar's authorization tests in CI

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: 3
- Category: tests, delivery, security
- Effort: S
- Risk: LOW
- Depends on: nothing
- Planned at: `80451e6`, 2026-07-24
- Finding: F-08

## Outcome

`sidecar/main_test.go` runs on every push and pull request. A change that breaks the remote-access
authorization gate fails CI instead of merging green.

## Why this matters

The Go sidecar is the trust boundary between a Tailscale network and the local studio. All nine of
its tests guard authorization:

```
TestProxyDeniesUnidentifiedCaller          TestProxyDeniesNodeWithoutStableID
TestProxyDeniesNonOwner                    TestDeviceTrackerKick
TestProxyFailsClosedWhenOwnerUnresolved    TestProxyDeniesKickedDevice
TestProxyStampsIdentityFromWhoIsNotFromClient
TestProxyOmitsSecretWhenUnset              TestSecretsEqualConstantTime
```

Identity spoofing prevention, non-owner denial, kicked-device enforcement, constant-time secret
comparison. Someone wrote careful tests for exactly the right things, and CI never runs one of them.

Worse, `go build` never runs either, so the sidecar is not even compile-checked. A Go change that
does not compile can merge, and `.github/workflows/ci.yml` will be green.

## Proven root cause

No workflow under `.github/workflows/` contains a Go step: `ci.yml` runs only `bun run verify:ci`,
and `verify:ci` (`package.json:41`) is 17 Bun and TypeScript gates with no Go among them.
`release.yml` builds through `scripts/build-desktop.ts` for three platforms and contains no sidecar
reference.

Inference, labelled: `sidecar/build.ts` documents itself as a manual step ("Run: `bun sidecar/build.ts`"),
so the sidecar was likely always built by hand and never joined the automated pipeline.

## Current architecture and authority

- `sidecar/main.go` (464 lines): `serve:268`, `newProxy:354`, header strip and stamp at `:366,:375`,
  `secretsEqual:462`, `resolveOwnerID:220`, `deviceTracker:94`.
- `sidecar/main_test.go` (191 lines): the nine tests above.
- `sidecar/go.mod`, `go.sum`: pinned module graph, so CI can build reproducibly.
- Consumed from TypeScript by `src/ui/remote/sidecar-manager.ts`, which spawns the binary and reads
  line-delimited JSON from its stdout.
- `src/ui/server-remote.ts:27`: "Resolve the bundled Tailscale sidecar binary. A missing binary fails
  soft."

## Target architecture

A Go job in `ci.yml`, parallel to the existing `test` job so it neither slows nor is slowed by the
Bun wall:

```yaml
  sidecar:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version-file: sidecar/go.mod
          cache-dependency-path: sidecar/go.sum
      - name: Vet
        run: go vet ./...
        working-directory: sidecar
      - name: Test
        run: go test ./... -count=1
        working-directory: sidecar
```

`go-version-file: sidecar/go.mod` pins the toolchain to what the module already declares, so the
version lives in one place. `-count=1` disables the test cache so a green result always means the
tests actually ran, which matters for a job whose entire purpose is that they run.

Deliberately **not** in scope: adding the sidecar to `release.yml`. See Maintenance notes; that is a
distribution question with its own risks and needs its own decision.

## Files

### Modify
- `.github/workflows/ci.yml`: add the `sidecar` job.
- `AGENTS.md` section 4 and `CLAUDE.md`: the gate tables describe `verify:ci` as the whole wall. If
  CI now runs a gate outside `verify:ci`, say so, or the same claim-versus-reality gap this finding
  is about simply moves.

### Do not touch
- `sidecar/main.go`. This plan runs the existing tests; it does not change behavior.
- `sidecar/main_test.go`, unless step 1 shows a test is already failing. See STOP conditions.
- `package.json`. Adding `go test` to `verify:ci` would break `bun run verify:ci` for every
  contributor without a Go toolchain, and the pre-push hook with it. Keep it a CI job.

## Implementation steps

### Step 1: Establish the Go baseline locally

```bash
cd sidecar && go vet ./... && go test ./... -count=1 -v
```

Verify: record the result verbatim. **This audit could not run this step**, because the Go toolchain
is not installed on the auditing machine. The tests are therefore of unknown current status. If any
fail, that is a finding in its own right and a STOP condition, not something to wire into CI as a
known-red job.

### Step 2: Add the job

Apply the workflow change above.

Verify: `bunx --yes yaml-lint .github/workflows/ci.yml` or equivalent parse check; the file must
remain valid YAML.

### Step 3: Prove the job can fail honestly

On a scratch branch, deliberately invert one authorization check, for example make `secretsEqual`
(`sidecar/main.go:462`) return `true` unconditionally, and push.

Verify: the `sidecar` job FAILS, and `TestSecretsEqualConstantTime` plus at least one proxy-denial
test are among the failures. Record the run URL. Revert. A job that has never been observed failing
is not yet a gate.

### Step 4: Confirm CI wiring end to end

Verify: on a normal pull request, both the `test` job and the new `sidecar` job appear and pass.
Confirm in the Actions UI, not by assumption.

### Step 5: Reconcile the documentation

Update `AGENTS.md` section 4 so the gate list reflects that CI runs Go tests in addition to
`verify:ci`. Do the same wherever `CLAUDE.md` describes the wall.

Verify: `bun run verify:ci` -> EXIT 0 (the docs gates are inside it).

## Test plan

- Baseline: `bun run verify:ci` green at `80451e6`; Go baseline from step 1.
- Honest RED: step 3, with the run URL recorded.
- Unchanged GREEN: step 4.
- Regression: the existing `test` job is untouched and must stay at 2250 pass.
- Explicitly out of scope: no new Go tests are written here. Wiring the existing ones is the whole
  outcome.

## Documentation and operations

- Note in the PR that `go test` is intentionally a CI job rather than part of `verify:ci`, so
  contributors without Go can still run the local wall.
- If the repository has a branch ruleset requiring status checks, the new `sidecar` check must be
  added to the required list, or it can fail without blocking a merge and this plan achieves
  nothing. `CONTRIBUTING.md:50` mentions the recommended protection; whoever owns that setting has
  to make this change too. Flag it explicitly in the PR.

## Done criteria

- `.github/workflows/ci.yml` contains a Go job that runs `go vet` and `go test ./... -count=1`.
- Step 3's deliberate break produced a red `sidecar` job, with the run URL recorded.
- A normal PR shows both jobs green.
- The required-status-checks list includes the new job, or the PR states plainly that a maintainer
  must add it.
- `AGENTS.md` no longer implies `verify:ci` is the complete gate wall.
- Independent review returns SHIPPABLE.

## STOP conditions

- **Any sidecar test fails at step 1.** Stop. A currently-failing authorization test on the
  remote-access boundary is a security finding, and it must be reported privately per `SECURITY.md`
  rather than wired into CI as a known-red job or disclosed in a public PR.
- `go vet` reports issues that require changing `main.go`. Fix in a separate change so this plan
  stays "run what exists".
- The module cannot build in CI because of a private or unavailable dependency in `go.sum`.
- Adding a required check would block all in-flight PRs. Coordinate the rollout instead of
  surprising contributors.

## Rollback and recovery

Remove the job from `ci.yml`. No source, data, or distribution change. If the required-checks list
was updated, remove the entry there too, otherwise every PR blocks on a check that no longer runs.

## Maintenance notes

- **The unresolved question this plan does not answer:** `release.yml` never builds the sidecar, and
  `src/ui/server-remote.ts:27` says a missing binary fails soft. So it is not established that
  official release artifacts contain a sidecar at all, and the remote-access feature may be
  unavailable in shipped builds. That needs a release artifact to check. It is a real question and
  it is deliberately out of scope here, because "run the tests" and "fix distribution" are different
  changes with different risk.
- Once the job exists, adding `go build` for the release matrix is a small increment on it.
- Reviewer trap: a green `sidecar` job on first run proves the job exists, not that it works. Step 3
  is the proof.
