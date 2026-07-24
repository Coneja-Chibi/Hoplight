# Hoplight systemic audit (Opus 5)

- **Mode:** `audit standard direct` (grumpy-systemic-audit skill)
- **Commit:** `80451e6` on `Mainstage`, clean tree
- **Date:** 2026-07-24
- **Auditor:** Claude Opus 5, conductor-only investigation, agent-assisted adversarial review
- **Revision:** 2, post-review. Revision 1 contained two findings that adversarial review disproved
  and that I then disproved myself. Both are retained below as withdrawn entries with the evidence
  that killed them, because deleting them would misrepresent what this audit actually found.

This was a model benchmark. A Fable 5 session audited the same commit in parallel, in a separate
worktree and branch. No notes or artifacts were shared, and nothing here was informed by that run.

## Headline

Hoplight is in good shape. `bun run verify:ci` is green at HEAD (2250 pass, 0 fail, 25560 expect()
calls), the defensive engineering is genuinely strong, and the Round-Trip Law that the project
leads with **is** enforced by CI, which I verified by breaking it.

This audit found **five MEDIUM defects and three LOW ones**. Three of the five MEDIUMs came from
leads raised by adversarial review rather than from my own pass. It also over-claimed twice, and the
corrections are as important as the findings.

## Verification baseline

```
bun install --frozen-lockfile     195 packages
bun run verify:ci                 EXIT 0
  2250 pass, 1 skip, 0 fail, 25560 expect() calls, 239 files
```

## Findings

| ID | Title | Severity | Confidence | Proof | Status |
| --- | --- | --- | --- | --- | --- |
| F-06 | Pygmalion export drops portraits and the honesty report conceals it | MEDIUM | HIGH | live | CONFIRMED (from a reviewer lead) |
| F-07 | 188 TypeScript files under `src/ui` are never linted | MEDIUM | HIGH | live | CONFIRMED (from a reviewer lead) |
| F-08 | The sidecar's authorization test suite never runs in CI | MEDIUM | HIGH | live | CONFIRMED (from a reviewer lead) |
| F-02 | CLI cannot convert presets or regex sets the studio converts | MEDIUM | HIGH | live | CONFIRMED |
| F-03 | Five character subtrees cross the storage boundary unvalidated | MEDIUM | HIGH | live | CONFIRMED |
| F-04 | "Loopback only" is inaccurate once LAN access is enabled | LOW | HIGH | live | CONFIRMED, impact corrected |
| F-01 | No gate compels a *new* adapter to ship round-trip evidence | LOW | HIGH | live | **DOWNGRADED from HIGH** |
| F-05 | `packagedSwitch` orchestration has no direct test | LOW | HIGH | code-read | **DOWNGRADED from MEDIUM** |

Findings F-06 through F-08 came from leads raised by the adversarial reviewers, not from my own
pass. Each required **executing** code to confirm, which is precisely the class of defect my
read-only method was structurally blind to. That the three strongest remaining findings all arrived
this way is the single most useful thing this audit learned about itself.

### [F-02] CLI cannot convert presets or regex sets the studio converts (MEDIUM)

Live-proven. Identical entity, identical target, same process, opposite outcomes:

```
detected source adapter: sillytavern-preset (kind=preset)

STUDIO  /api/export  sillytavern-preset -> rolecall-preset
  HTTP 200, wrote 2867 chars as .json

CLI     convertFile  sillytavern-preset -> rolecall-preset
  FAILED: convert: cannot convert a preset to a preset (different entity kinds)
```

Reproduced from the shipped CLI: `hoplight convert samples/sillytavern/presets/plain.preset.json
--to rolecall-preset out.json` exits 1. Regex behaves identically.

**Evidence.** `src/convert.ts:143-159` branches on character, lorebook, and persona only; preset and
regex fall through to the throw at `:160`. `src/ui/server-engine.ts:158` rejects only a kind
*mismatch*, then `:173` casts `target.fromCanonical` to a generic signature for every non-character
kind, so the studio works. `docs/FORMAT-SUPPORT.md:53-70` advertises 4 preset and 5 regex adapters.

**Two distinct harms.** Nine advertised adapters are unreachable from the CLI, so scripted preset
and regex migration is impossible while the GUI does it happily. And the error message is
**factually false**: it tells a user converting a preset to a preset that these are "different
entity kinds", describing a condition that is not the real one.

**Corrections applied after review.** Severity lowered from HIGH to MEDIUM: the failure is
fail-closed (clear message, exit 1, nothing written, no corruption, no data loss, no security
surface), and the flagship surface covers the case. I also overstated the invariant claim: I cited
`src/convert.ts:10` ("Studio inspect/export must compose the same service as the CLI") as a violated
rule, but that sentence sits in a docblock about the *bundle* layer. More tellingly,
`src/convert.ts:72-73` describes `inspectPresetBundle` as "Shared by Studio inspect and any future
CLI bundle path", which reads as known, deliberately deferred work rather than an oversight. The
defect is real; the framing was too accusatory.

### [F-03] Five character subtrees cross the storage boundary unvalidated (MEDIUM)

Live-proven. `CLAUDE.md:57` says `src/entities/runtime-schema.ts` validates at the storage and HTTP
boundaries. It describes 11 of `CharacterBody`'s 16 top-level fields.

```
runtime-schema safeParse -> ok=true
POST /api/studio/save    -> HTTP 200 ACCEPTED

read back from disk:
  variants     = "not-an-array-at-all"      (declared CharacterVariant[])
  behavior     = {"conditions":12345,"effects":{"nested":{"deeply":[null,null]}}}
  presentation = [1,2,3]
  settings     = "a string where an object belongs"
  bias         = {"logitBias":"should-be-structured"}
```

Unvalidated: `behavior`, `bias`, `presentation`, `settings`, `variants`.

**Root cause.** The canonical shape is defined twice, by hand.
`src/entities/character/schema.ts` declares ~20 `export interface` types and imports no zod;
`src/entities/runtime-schema.ts:37` independently rebuilds them as zod `looseObject`s. This
contradicts `docs/03-CONVENTIONS.md:10` and `CLAUDE.md:104` ("zod schemas are the single source of
truth ... no duplicate interfaces"). Two hand-maintained definitions drift, and these have.

The control that might have caught it does not cover it:
`src/ui/switch/storage-shape-tripwire.test.ts` hashes only `runtime-schema.ts`,
`settings-shape.ts`, and `canonical.ts`. `src/entities/*/schema.ts` is absent.

**Corrections applied after review.** Severity lowered from HIGH to MEDIUM and the security framing
**withdrawn**. I demonstrated this through `POST /api/studio/save`, which implies an attacker path
that does not exist: every `/api/` route is gated by a Host check, an allowlisted loopback Origin,
and a `timingSafeEqual` comparison against a per-launch 32-byte token, and the trusted server binds
`127.0.0.1`. Nothing untrusted reaches this boundary. `z.looseObject` also passes unknown keys **by
design**, consistent with the escrow philosophy, so nothing is dropped. The honest impact is
data-integrity and fail-closed doctrine: a malformed or hand-edited piece crashes an editor via
`body.variants.map(...)` on a string, with no useful error.

### [F-04] "Loopback only" is inaccurate once LAN access is enabled (LOW)

`src/ui/remote/lan-server.ts:175` binds `0.0.0.0` (comment at `:169` confirms), against
`README.md:950` ("The server binds 127.0.0.1 only"), `:125`, `:939`, `:988`, `SECURITY.md:30`,
`SECURITY.md:48`, and `CLAUDE.md:67`. The process runs four listeners plus a Tailscale sidecar node.

**Corrections applied after review.** Severity lowered from MEDIUM to LOW, and my central impact
claim was **wrong**. I argued that `SECURITY.md` scopes researchers away from the LAN listener.
`SECURITY.md:28-30` actually reads "Reports most valuable here:", which is a prioritization, not a
scope fence, and the document's only explicit exclusion is attackers who already run code on the
machine. The LAN feature is also documented truthfully under `docs/reference/`, which is where
`AGENTS.md:84-85` actually binds the docs rule. What remains is a genuine but small wording defect
in three summary documents. The feature itself is opt-in, TLS-wrapped, argon2id connect-code gated,
per-IP throttled, and host-approved; the engineering is sound.

### [F-01] No gate compels a *new* adapter to ship round-trip evidence (LOW, downgraded from HIGH)

**Revision 1 claimed the Round-Trip Law is not enforced by CI. That claim was false and I withdraw
it.** The correction matters more than the residual, so it goes first.

I copied `src/formats/_template` to a real folder with a `fromCanonical` returning empty text and
observed `verify:ci` pass green, and concluded the Law was unenforced. **The probe was invalid.**
`_template`'s `detect()` returns `0`; `src/core/registry.ts:10` sets `DETECT_THRESHOLD = 0.5` and
`:40` returns `undefined` below it. The adapter could never be selected as a source, so it never
round-tripped anything. Its green run proved nothing.

The correct experiment, which I then ran, disproves the finding. Breaking the escrow re-merge in a
shipping codec (`src/formats/sillytavern/index.ts:128-133`, replacing the conditional with
`const base: TavernData = {}`) produced:

```
1361 pass, 8 fail
```

CI blocks a deliberately-broken round-trip, which is exactly the `docs/ROADMAP.md` M0 exit criterion
I claimed was unmet. Roughly 40 named round-trip tests exist across every shipped adapter folder.

Two further errors in revision 1. I quoted the ROADMAP exit line and its JEWEL DONE status while
omitting the governing "Code reality" clause at `:66-67` that scopes DONE to "tsc + bun test +
color/line scans", which is precisely the bar I measured as green. And I dismissed
`src/ui/receipt.test.ts` as "a cosmetic display-name map" when its docblock states it is a
registry-walking gate that fails on any adapter without a friendly name. It was working as designed
and it caught my probe.

**The residual, which is real but small:** no gate requires a newly added drop-in adapter to ship
round-trip evidence of its own, and `specs/formats/escrow-and-roundtrip.md:16-17` still describes a
`fixtures/<format>/**` auto-discovery harness that does not exist in this tree (a leftover from the
abandoned `packages/*` layout). `AGENTS.md:69` already frames the Law as fixture-scoped, so the
current design is deliberate. This is a contributor-discipline nice-to-have plus a stale spec line.

### [F-05] `packagedSwitch` orchestration has no direct test (LOW, downgraded from MEDIUM)

**Revision 1 claimed "the update download and staging path has zero tests". That was materially
false.** `resolveAsset` and `isAllowedDownloadHost`, the two security-critical guards on that path,
live in `src/ui/_shared/release-download.ts:13,26` and have a dedicated test file. I asserted
`packaged-engine.ts` "owns asset resolution"; it does not, it imports it.

**The residual:** `packagedSwitch` itself (`src/ui/switch/packaged-engine.ts:113`) has no direct
test of its orchestration, specifically the checksum comparison at `:145` and the staging write at
`:150`. Its logic is correct and fails closed at every branch, which I verified by reading it. Also
untested: `switch/git-runner.ts`, `switch/setup.ts`.

### [F-06] Pygmalion export silently drops portraits and the honesty report conceals it (MEDIUM)

Live-proven across four samples from three source formats. This is the most user-visible defect in
the audit and it was found by chasing a reviewer's lead, not by my own pass.

**Evidence.** `src/formats/pygmalion/coverage.ts:17` declares `"media.portrait"` in `carries`.
`src/formats/pygmalion/index.ts:150-168` `fromCanonical` emits a PNG carrier **only** when
`entity.original.pygmalion.sourceMedia` exists. It never reads `body.media.portrait`. So a character
imported from any other format has no pygmalion escrow, falls through to the JSON branch at `:168`,
and loses its portrait.

`src/core/reports.ts:87` computes the dropped list as everything the target's `CoverageDecl` does
**not** cover, via `coversPath`. Because `media.portrait` is declared carried, the loss is exempted
from the report.

```
samples/backyard/characters/2.byaf              -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/backyard/characters/3.byaf              -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/sillytavern/characters/v3-full.json     -> pygmalion  .json  image=NO  portrait reported dropped? false
samples/rolecall/characters/vera-casting-card   -> pygmalion  .json  image=NO  portrait reported dropped? false
```

Each source entity genuinely populates `body.media.portrait`; each output carries no image; none
reports the loss. **`media.assets` appears in every dropped list**, which proves the reporting
machinery works correctly and that `media.portrait` alone is being suppressed by the declaration.

**Why this is worse than an ordinary drop.** Hoplight's honesty reporting exists precisely so users
know what a conversion will cost them. Here it actively asserts a portrait survives when it does
not. A silent loss with a clean report is worse than a loud loss.

**Note on intent.** `coverage.ts:22` already knows the truth: "PNG carrier pixels when imported from
a Pygmalion-style chara PNG; not a card key". But `notes` is prose and `carries` is the
machine-readable claim that `coversPath` consumes unconditionally. The declaration over-claims
relative to its own note. This is the exact failure mode `src/core/coverage.ts:7-8` warns about when
it says the harness pinning claims to codec reality is "tracked follow-up work".

**Fix direction.** Either make `fromCanonical` honor `body.media.portrait` when no escrow exists, or
remove `media.portrait` from `carries` so the report tells the truth. The first is better for users;
the second is honest immediately. Prefer the first, ship the second first if they must be split.

### [F-07] 188 TypeScript files under src/ui are never linted (MEDIUM)

Live-proven. `AGENTS.md:110` describes `lint:ui` as "eslint on the React shell, zero warnings".

**Evidence.** `package.json:38` globs `"src/ui/**/*.tsx"`, and `eslint.config.mjs:43` **also** scopes
its `files` key to `src/ui/**/*.tsx`, so this is not merely a CLI glob: eslint has no configuration
that matches a `.ts` file at all. 188 non-test `.ts` files under `src/ui` are excluded, including
`api.ts`, `docs-corpus.ts` (path containment), and everything under `_shared/` and `remote/`.

Three of them define React hooks: `src/ui/shell/menus.ts`, `src/ui/apps/workbench/use-variants.ts`,
`src/ui/apps/workbench/lore/use-marinara-folders.ts`.

**Reproduction.** I planted a conditional `useState` (the violation `eslint.config.mjs:51` calls
"always an error" because "conditional/looped hooks corrupt React's dispatcher state") into
`src/ui/apps/workbench/use-variants.ts`:

```
bun run lint:ui                                     -> EXIT 0, clean
bunx eslint src/ui/apps/workbench/use-variants.ts   -> "File ignored because no matching configuration was supplied"
same code copied to a .tsx file                     -> error react-hooks/rules-of-hooks
bun run verify:ci                                   -> EXIT 0, 2250 pass, 0 fail
```

The rule works perfectly. The scoping excludes the files. The complete wall ships a
dispatcher-corrupting hook violation without complaint. Probe reverted.

**Fix direction.** Widen both the `package.json` glob and the `eslint.config.mjs` `files` key to
`src/ui/**/*.{ts,tsx}`, keeping the JSX-only `no-restricted-syntax` block scoped to `.tsx`. Expect
an initial backlog of warnings.

### [F-08] The sidecar's entire authorization test suite never runs in CI (MEDIUM)

**Evidence.** No workflow under `.github/workflows/` contains a Go step, and `verify:ci`
(`package.json:41`) has none either. `sidecar/main_test.go` holds nine tests, and every one of them
guards the remote-access authorization boundary:

```
TestProxyDeniesUnidentifiedCaller        TestProxyDeniesNodeWithoutStableID
TestProxyDeniesNonOwner                  TestDeviceTrackerKick
TestProxyFailsClosedWhenOwnerUnresolved  TestProxyDeniesKickedDevice
TestProxyStampsIdentityFromWhoIsNotFromClient
TestProxyOmitsSecretWhenUnset            TestSecretsEqualConstantTime
```

Identity spoofing prevention, non-owner denial, kicked-device enforcement, and constant-time secret
comparison. None execute in CI. Neither does `go build`, so the sidecar is not even compile-checked.

**Limitation, stated honestly.** The Go toolchain is not installed on this machine, so I could not
run the suite to confirm it currently passes. What is verified is that CI never runs it.

**Unresolved secondary observation.** `release.yml` builds only through `scripts/build-desktop.ts`,
which contains no sidecar reference, and `sidecar/build.ts` documents itself as a manual step
("Run: `bun sidecar/build.ts`"). `src/ui/server-remote.ts:27` says a missing binary "fails soft".
Whether official release artifacts actually contain a sidecar binary is **not determined** here; it
would need a release artifact to check. Flagging rather than guessing.

## Systemic theme: withdrawn, then re-established on different evidence

Revision 1 proposed: "Hoplight's documented guarantees are consistently stronger than the gates that
enforce them." I **withdrew** it, correctly, because it rested on F-01 and F-05 and both collapsed.
A reviewer called it "a compliment wearing a finding's clothes" and was right about the version I
had built.

Chasing the reviewers' leads then produced three confirmed instances that do hold, each proven by
execution:

| Claim | Where stated | Reality |
| --- | --- | --- |
| `media.portrait` is carried by the Pygmalion codec | `src/formats/pygmalion/coverage.ts:17` | Dropped for every non-Pygmalion source, and the loss report suppresses it (F-06) |
| "eslint on the React shell, zero warnings" | `AGENTS.md:110` | 188 `.ts` files under `src/ui` have no matching eslint config (F-07) |
| `verify:ci` is "the whole wall" | `AGENTS.md:93`, `CLAUDE.md:19` | No Go step, so nine authorization tests never run (F-08) |

Add F-03 (`CLAUDE.md:57` says the boundary is validated; five fields are not) and F-04 (docs say
loopback only; a `0.0.0.0` listener exists) and the theme stands on five independent instances
rather than two bad ones.

So the honest verdict is the one the completeness critic reached: **the theme is right, for reasons
this audit did not originally find.** I reached the correct conclusion through two invalid probes,
which is not the same as being right, and the corrected version is only trustworthy because the
review process forced the re-derivation.

The counter-evidence still deserves weight, because it is real and it bounds the theme: this
codebase repeatedly documents its own weaknesses rather than overclaiming.
`src/core/coverage.ts:5-8` volunteers that coverage claims are unpinned, which is exactly the gap
F-06 exploits. `src/ui/server-security.ts:45-49` explains why the loopback host gate is deliberately
permissive. `src/ui/switch/storage-shape-tripwire.test.ts` exists specifically to stop a control
from silently falling behind. The pattern is not dishonesty; it is a fast-moving project whose
summary documents and gate globs lag its code. That distinction should shape the fix: widen the
gates, do not rewrite the culture.

## Rejection ledger

| Candidate | Verdict |
| --- | --- |
| `SCHEMA_BUMPS` empty makes the rollback guard inert | REJECTED, by design. `CANONICAL_SCHEMA_VERSION` has never moved, and the storage-shape tripwire forces a deliberate decision on any change. A good control. |
| Zip-slip / archive path traversal | REJECTED. No on-disk archive extraction exists anywhere; entries are in-memory map keys. Independently confirmed during review, which traced every `unzipBounded` consumer and every filesystem write in `src/`. |
| Files near the 500-line cap | NOT A DEFECT. `scan:lines` is a live gate; proximity to a cap is not a defect. |
| `pack` kind with zero adapters | NOT WORTH DOING. `scripts/format-matrix.ts:29-39` deliberately renders a zero-adapter kind as an honest "(none yet)" row. |
| The Round-Trip Law is not CI-enforced | **REJECTED, disproven by experiment.** See F-01. |
| The update path has zero tests | **REJECTED, disproven.** See F-05. |

## Reviewer leads: chased and resolved

The completeness critic raised four leads. Three were chased to confirmation and promoted to
findings F-06, F-07, and F-08 above. One could not be reproduced and stays a lead.

| Lead | Outcome |
| --- | --- |
| Pygmalion `media.portrait` over-claim | **CONFIRMED** -> F-06, live-proven on 4 samples |
| `lint:ui` glob excludes `.ts` | **CONFIRMED** -> F-07, live-proven with a planted violation |
| No Go step in CI | **CONFIRMED** -> F-08 |
| Archive entry-count DoS | **NOT REPRODUCED**, remains open below |

### Open: archive entry-count DoS (UNREPRODUCED, security-sensitive)

The claim: `fflate` reads a declared entry count from an attacker-controlled zip64 EOCD and loops
that many times, while `src/core/archive.ts`'s `maxEntries` check sits inside the filter callback
and so can never terminate the loop. Reported as 967ms from a 98-byte file at 16M declared entries,
reachable through `registry.detect()` because risu, lumiverse, and byaf each sniff `PK`, and
blocking the event loop because `unzipSync` is synchronous.

**I could not reproduce it.** My crafted zip64 EOCD threw `ArchiveLimitError` in 2-5ms with no
scaling at all:

```
declared=   1,000,000  bytes=98  5ms  -> ArchiveLimitError
declared=   4,000,000  bytes=98  2ms  -> ArchiveLimitError
declared=  16,000,000  bytes=98  2ms  -> ArchiveLimitError
```

Flat, not linear, which is the opposite of the reported measurement. The most likely explanation is
that my header craft is wrong and fflate rejects it before reaching the zip64 central-directory
path, so this is evidence about my probe rather than about the code.

**Status: open.** It is not a finding and must not be reported as one. If pursued, it should be
investigated against fflate's actual zip64 parsing and handled privately per `SECURITY.md`, since a
confirmed result would be a remote-triggerable denial of service on every listener at once.

## Coverage: what was and was not audited

**Audited with call-path depth:** `src/convert.ts`; `src/core/` canonical model, registry, loader,
archive, coverage; `src/entities/` schemas and runtime validation; `src/ui/server*.ts` route table
and security context; `src/studio/` path policy, atomic writes, store; `src/ui/switch/` update and
rollback; `src/formats/` adapter contract, registration, and escrow sites; CI workflows; the root
instruction and policy documents.

**Not audited in depth:** `src/ui/` React shell and the 8 apps (489 of 829 files); sandbox
adversarial testing; per-adapter mapping fidelity (66 files); `sidecar/` internals; the
`scripts/audit/` UI harness; performance and capacity entirely; accessibility; any live browser
journey.

**Honest assessment of scale.** Five findings across 829 files is roughly one per 166 files, and
about 60-70% of the codebase was never examined. The severity distribution (0 CRITICAL, 0 HIGH after
correction, 5 MEDIUM, 3 LOW) has no long tail of LOWs, which real sweeps produce. Read this as a
scoping pass over roughly a third of the repository, not as a verdict on it.

**Method limitation, stated plainly, and then partly corrected.** None of my five original findings
required executing the code; all were legible from structure alone. That is the finding-shape a
read-only pass produces, and it explains why my first systemic theme was partly an artifact of
method rather than a property of the code.

The correction is the most instructive result here. Every one of the three strongest findings
(F-06, F-07, F-08) came from a reviewer's lead and required **running** something to confirm: four
adapter exports for F-06, a planted lint violation for F-07, a workflow and test-suite enumeration
for F-08. F-06 in particular took two attempts, because my first probe used a source entity that
did not populate `media.portrait` at all and proved nothing, the same class of error that sank F-01.

Running `direct` (no shards) on a 102k-line repository concentrated depth on authority boundaries
and left breadth surfaces untouched. A sharded pass with a mandate to execute rather than read would
find more, and different, defects, and `src/ui` (489 files), per-adapter fidelity (66 files), and
the sandbox remain the places to point it.

## Reviewer verdicts

Sixteen independent fresh-context reviewers, three lenses per finding (evidence accuracy, by-design
check, impact realism) plus one completeness critic. Each was given the raw repository instructions,
the raw finding, and the source, and told to assume the finding was wrong. None saw a preferred
verdict.

| Finding | Refuted | Conductor action |
| --- | --- | --- |
| F-01 | 3/3 | Withdrawn as stated, re-verified myself, downgraded to LOW |
| F-02 | 0/3 | Severity HIGH -> MEDIUM, invariant claim softened |
| F-03 | 1/3 | Severity HIGH -> MEDIUM, security framing withdrawn |
| F-04 | 1/3 | Severity MEDIUM -> LOW, impact claim corrected |
| F-05 | 3/3 | Withdrawn as stated, downgraded to LOW |

Every objection above was verified by me against primary source before being accepted. I did not
accept the reviewers' conclusions on trust any more than I expected them to accept mine.
