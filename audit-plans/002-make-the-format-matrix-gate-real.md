# Plan 002: Make the format matrix gate real

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: P2
- Category: tests/delivery
- Effort: S
- Risk: LOW
- Depends on: none
- Planned at: commit `80451e6`, 2026-07-24
- Finding: GATE-01 in AUDIT.md

## Outcome

`bun test` never writes to the working tree; `matrix:check` genuinely fails CI when the committed
`docs/FORMAT-SUPPORT.md` is stale against the adapter registry; `bun run matrix` remains the one
way the file is written.

## Why this matters

Today the matrix gate is decorative. `scripts/format-matrix.ts` runs its whole main flow at module
scope; `scripts/format-matrix.test.ts:7` imports it; the `test` script includes `scripts/`, so
every `bun test` run regenerates `docs/FORMAT-SUPPORT.md` from the live registry with today's
date. In `verify:ci`, `test` runs before `matrix:check` (package.json), so the check always
compares a just-regenerated file against another fresh regeneration: it cannot fail, and a stale
committed matrix ships with CI green. Side effect two: every developer test run dirties the tree
(live-proven this session; the audit worktree carried exactly this date-only diff).

## Proven root cause

`scripts/format-matrix.ts`:

- line 11: `const checkOnly = process.argv.includes("--check");` reads bun test's argv, so
  `checkOnly` is false under the test runner;
- line 13: `const found = await loadFormats();` runs at import;
- lines 102-128: entity-kind readdir, render with `new Date()`, then either the check branch or,
  when `checkOnly` is false (the test-import case), line 127 `writeFileSync(outPath, body)`.

The test imports only the pure exports `matrixKinds` and `renderFormatMatrix`, but importing the
module executes everything above.

## Current architecture and authority

- The generator is both a CLI entry point (package.json scripts `matrix`, `matrix:check`) and a
  library for its test. The sibling hook scripts already model the fix: pre-commit logic lives in
  pure `scripts/hooks/pre-commit-core.ts` imported by its test, with the impure runner separate.
- `verify:ci` order (package.json): `... bun run test && ... && bun run matrix:check && ...`.
  The order itself is fine once the side effect is gone; do not reorder.

## Target architecture

`scripts/format-matrix.ts` keeps its pure exports at module scope and moves every side effect
behind an entry guard. Invariant: importing the module performs no I/O.

Exact shape (replace lines 10-13 and 102-128; keep `matrixKinds` and `renderFormatMatrix`
unchanged in between):

```ts
const outPath = join(import.meta.dir, "../docs/FORMAT-SUPPORT.md");

// (matrixKinds, KIND_TITLES, KIND_ORDER, renderFormatMatrix stay in place, but BOTH
// module-scope helpers currently typed off `typeof found` must be retyped, because
// `found` moves inside main(): the `row` helper at scripts/format-matrix.ts:15-16
// (`(a: (typeof found)[number])`) and renderFormatMatrix's `adapters: typeof found`
// parameter. Use the explicit adapter shape they actually consume, e.g.
// `FormatAdapter` / `FormatAdapter[]` imported as a type from ../src/core.)

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const found = await loadFormats();
  const entityKinds = readdirSync(join(import.meta.dir, "../src/entities"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const body = renderFormatMatrix(found, CANONICAL_SCHEMA_VERSION, new Date().toISOString().slice(0, 10), entityKinds);

  if (checkOnly) {
    // (existing check branch, lines 108-124, unchanged including date normalization)
    return;
  }
  writeFileSync(outPath, body, "utf8");
  console.log(`wrote ${outPath} (${found.length} adapters)`);
}

if (import.meta.main) await main();
```

Also delete the leftover thinking-aloud comment at lines 116-117 ("Actually plan wants...") while
that block moves; keep the date-normalization behavior itself exactly as is.

Why this removes the cause: the test import no longer executes `main()`, so `bun test` writes
nothing; in CI the file `matrix:check` reads is the committed one, so staleness fails honestly.

## Files

### Modify
- `scripts/format-matrix.ts`: entry-guard restructure above; type the render params explicitly.
- `scripts/format-matrix.test.ts`: add the no-side-effect regression test below.

### Do not touch
- `package.json` scripts (`matrix`, `matrix:check`, `verify:ci` order all remain correct).
- `docs/FORMAT-SUPPORT.md` content (Plan 003 owns the template fix and regeneration).
- Other generator scripts (`docs-index`, `docs-fields`, `docs-figures`): out of scope. They have
  no tests of their own, so nothing imports them under `bun test`; `scripts/` contains exactly one
  test that imports a side-effectful generator (format-matrix.test.ts), and the four
  `scripts/hooks/*.test.ts` files import only pure `-core`/`-lib` modules (verified at planning
  time).

## Implementation steps

### Step 1: RED

Add to `scripts/format-matrix.test.ts` a subprocess-based no-write assertion:

```ts
test("importing the generator module performs no write", () => {
  const before = statSync(new URL("../docs/FORMAT-SUPPORT.md", import.meta.url)).mtimeMs;
  const r = Bun.spawnSync(["bun", "-e", 'await import("./scripts/format-matrix.ts"); '], {
    cwd: new URL("..", import.meta.url).pathname,
  });
  expect(r.exitCode).toBe(0);
  const after = statSync(new URL("../docs/FORMAT-SUPPORT.md", import.meta.url)).mtimeMs;
  expect(after).toBe(before);
});
```

Verify: `bun test scripts/format-matrix.test.ts` -> the new test FAILS on current code (mtime
changes). Honest RED.

### Step 2: GREEN

Apply the restructure. Do not weaken the new test.

Verify: `bun test scripts/format-matrix.test.ts` -> all pass, including the two existing pure
tests (they must not need edits; if they do, STOP: the pure surface changed).

### Step 3: Prove the gate now bites

In the worktree (revert afterwards, no commit):

1. `bun run matrix` then `git diff docs/FORMAT-SUPPORT.md` -> date-only or empty diff; restore.
2. Hand-edit one row of `docs/FORMAT-SUPPORT.md` (e.g. delete an adapter line).
3. `bun run test` -> tree still shows ONLY your hand edit (no rewrite).
4. `bun run matrix:check` -> exits 1 with the stale message.
5. `git checkout -- docs/FORMAT-SUPPORT.md`.

### Step 4: Broad checks

Verify: `bun run typecheck`; `bun run test` (baseline 2250 pass) and afterwards
`git status --porcelain` shows no generated churn; `bun run verify:ci` passes.

## Test plan

Steps 1-2 are the focused RED/GREEN. Step 3 is the live journey for the gate itself. The existing
`matrixKinds`/`renderFormatMatrix` tests are the regression net for the pure surface.

## Documentation and operations

`docs/FORMAT-SUPPORT.md`'s header line "Auto-generated from live adapters (`bun run
scripts/format-matrix.ts`)" stays true. No reference page documents the import side effect
(nothing to update). AGENTS.md's gate table line for `matrix:check` becomes true instead of
aspirational; its wording needs no change.

## Done criteria

- Step 3 sequence behaves exactly as specified (hand-staled file fails matrix:check after a full
  test run).
- `bun run test` leaves `git status --porcelain` empty on a clean checkout.
- `bun run verify:ci` passes.
- Diff touches only `scripts/format-matrix.ts` and `scripts/format-matrix.test.ts`.
- Independent review returns SHIPPABLE.

## STOP conditions

- The existing pure tests require edits to survive the restructure.
- Any other test in the suite turns out to depend on the import-time write (search first:
  `grep -rn "FORMAT-SUPPORT" src scripts` shows only the generator, its test, and prose corpus
  references at planning time).
- `verify:ci` fails at matrix:check after the change on an honest tree: that means the committed
  matrix was ALREADY stale and masked; regenerate via `bun run matrix`, commit that separately,
  and say so in the report.

## Rollback and recovery

Single-commit revert restores the old (defective but familiar) behavior; no data or release risk.

## Maintenance notes

- Invariant for future generators: a script that a test imports must be side-effect-free at import
  (entry-guard or split a `-core` module, as the hooks already do).
- Reviewer trap: do not "fix" this by excluding `scripts/` from the test script; that would delete
  real coverage to hide the symptom.
