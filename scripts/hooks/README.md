# Repo guardrails

Mechanical gates that stop me (and any agent working in this repo) from shipping the class of mistake
that memory alone cannot prevent, because reading memory is a choice and a hook is not. They raise the
floor on our standing doctrine; they do **not** make anyone infallible. A novel logic bug nobody wrote
a check for still gets through. What these guarantee is that skipping verification stops being silent
and effortless and becomes a deliberate, recorded act.

## The gates

| Gate | Fires on | Blocks when | Cleared by |
| --- | --- | --- | --- |
| green | pre-commit, Stop | `bun run test` is red | fix the supported suite |
| core-purity | pre-commit, Stop | a changed `*-core.ts` reaches for effects (`document`, `fetch`, `Bun.`, ...) | move the effect to the shell |
| core-sibling | pre-commit, Stop | a changed `*-core.ts` has no `*-core.test.ts` | add the sibling test |
| branch-test | commit-msg | a new branch is added to the shell (`boot.ts` / an app `index.ts`) with no test touched | touch a test **or** add a `Verified: <how>` line to the commit message |
| typecheck | pre-push | `tsc --noEmit` is red | fix the types |
| no-verify | Claude Code Bash | a command runs `git commit/push --no-verify` | do not bypass; fix the violation |

## Two surfaces

- **git** (`.githooks/`, wired via `git config core.hooksPath .githooks`): the commit/push backstop, for
  any committer. A fresh clone must run `git config core.hooksPath .githooks` once (or a setup script).
- **Claude Code** (`.claude/settings.json`): the live gate that fires on every agent in this repo the
  moment it tries to declare done (`Stop` runs the gate) or bypass a hook (`PreToolUse` on Bash). This
  is what "stops me and other agents" mid-work, not just at commit time.

## Layout (drop-in)

- `lib.ts` - the pure detectors (no fs, no git, no process). Unit-tested in `lib.test.ts`, which the
  supported `bun run test` suite runs, so the guardrails cannot rot silently. This is why the logic lives here
  in `scripts/hooks/` and not under `.claude/` (bun skips dot-directories).
- `gate.ts` - green + core-purity + core-sibling. `--staged` (pre-commit) or `--worktree` (Stop).
  Green means `bun run test` (active roots only). Parked `src/macros` is `test:macros`, not a release gate.
- `branch-note.ts` - the branch-test gate (commit-msg).
- `guard-bash.ts` - the no-verify blocker (Claude Code PreToolUse).

Exit contract everywhere: **2** = block (the shared git + Claude Code contract), **0** = pass, **1** =
the gate's own infrastructure broke (non-blocking, so a bad gate never locks the repo). It fails closed
on a real violation, open on its own breakage.

## Adding a gate

Add a pure detector to `lib.ts`, a test to `lib.test.ts`, call it from the relevant shell
(`gate.ts` / `branch-note.ts`), and prove it blocks red-first before trusting it. An untested guardrail
is the exact sin these exist to catch.
