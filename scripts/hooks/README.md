# Repo guardrails

Mechanical gates that stop common structural mistakes without making ordinary commits feel like a CI
run. They raise the floor on our standing doctrine; they do **not** make anyone infallible. A novel
logic bug nobody wrote a check for can still get through, so tests and honest verification remain part
of the work even though commit messages do not require special trailers.

## The gates

| Gate | Fires on | Blocks when | Cleared by |
| --- | --- | --- | --- |
| structural | pre-commit, Stop | the line cap, core purity/sibling, HTML sink, or shell import rules fail | fix the structural violation |
| staged-colors | pre-commit | staged UI additions contain hardcoded colors | use theme tokens |
| component-catalog | relevant pre-commit changes | the generated component reference is stale | regenerate the catalog |
| staged-ui-lint | pre-commit | staged live UI TSX has an ESLint error or warning | fix the staged files |
| green | pre-push, Stop | `bun run test` is red | fix the supported suite |
| typecheck | pre-push | `bun run typecheck` is red | fix the types |
| no-verify | editor pre-tool | a command runs `git commit/push --no-verify` | do not bypass; fix the violation |

## Two surfaces

- **git** (`.githooks/`, wired via `git config core.hooksPath .githooks`): the commit/push backstop, for
  any committer. A fresh clone must run `git config core.hooksPath .githooks` once (or a setup script).
- **Editor hooks**: an optional live gate that can fire on every command in this repo the
  moment it tries to declare done (`Stop` runs the gate) or bypass a hook (`PreToolUse` on Bash). This
  is what "stops me and other agents" mid-work, not just at commit time.

## Layout (drop-in)

- `lib.ts` - the pure structural detectors (no fs, no git, no process). Unit-tested in `lib.test.ts`,
  which the supported suite runs so the guardrails cannot rot silently.
- `pre-commit-core.ts` - pure parsing and routing for staged paths, tested beside the implementation.
- `pre-commit.ts` - fast orchestration: structural and color checks every time, then catalog and UI
  lint only when the staged paths make them relevant.
- `gate.ts` - structural checks in `--staged` mode; structural checks plus `bun run test` in
  `--worktree` mode for the editor Stop gate.
- `.githooks/pre-push` - the full local proof: typecheck followed by the supported test suite.

Exit contract everywhere: **2** = policy violation, **1** = hook infrastructure failure, **0** = pass.
Git blocks every nonzero result; the distinct failure codes keep the diagnosis clear.

## Adding a gate

Add a pure detector to the relevant core module, test it beside that module, call it from the smallest
appropriate hook surface, and prove it blocks red-first before trusting it. Keep pre-commit checks
staged and fast; put whole-repository proof in pre-push or CI.
