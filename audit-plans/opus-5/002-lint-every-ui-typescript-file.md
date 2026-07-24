# Plan 002: Lint every TypeScript file under src/ui, not just the .tsx ones

> Executor contract: Read the entire plan. Follow steps in order. Run every
> verification gate. Touch only in-scope files. Stop on any STOP condition.
> Report deviations instead of silently improvising.

## Status

- Priority: 2
- Category: tests, delivery
- Effort: M (the config change is XS; the backlog it exposes is the work)
- Risk: LOW
- Depends on: nothing
- Planned at: `80451e6`, 2026-07-24
- Finding: F-07

## Outcome

`bun run lint:ui` covers every authored TypeScript file under `src/ui`, so a rules-of-hooks
violation in a `.ts` file fails CI instead of shipping. `AGENTS.md:110` becomes true.

## Why this matters

`eslint.config.mjs:51` calls `react-hooks/rules-of-hooks` an error because "conditional/looped hooks
corrupt React's dispatcher state". That rule currently does not run on the three files that define
React hooks outside JSX:

- `src/ui/shell/menus.ts` (`useContextMenu`)
- `src/ui/apps/workbench/use-variants.ts`
- `src/ui/apps/workbench/lore/use-marinara-folders.ts`

188 non-test `.ts` files under `src/ui` are unlinted in total, including `api.ts`, `docs-corpus.ts`
(path containment), and everything under `_shared/` and `remote/`.

Live-proven. I planted a conditional `useState` in `use-variants.ts`:

```
bun run lint:ui                                    -> EXIT 0, clean
bunx eslint src/ui/apps/workbench/use-variants.ts  -> "File ignored because no matching configuration was supplied"
the identical code in a .tsx file                  -> error react-hooks/rules-of-hooks
bun run verify:ci                                  -> EXIT 0, 2250 pass, 0 fail
```

The rule works. The scoping excludes the files. The complete wall shipped it.

## Proven root cause

Two independent scopings, both `.tsx` only, so widening one alone changes nothing:

```jsonc
// package.json:38
"lint:ui": "bunx eslint \"src/ui/**/*.tsx\" --max-warnings 0",
```

```js
// eslint.config.mjs:43
files: ["src/ui/**/*.tsx"],
```

The config `files` key is the load-bearing one: with no matching config block, eslint ignores a
`.ts` file even when it is named explicitly on the command line, which is exactly what the
"File ignored because no matching configuration was supplied" message reports.

Inference, labelled: the config was written when the React shell was assumed to be entirely `.tsx`,
and the custom hooks and `_shared` helpers arrived later as `.ts`.

## Target architecture

```js
// eslint.config.mjs
{
  files: ["src/ui/**/*.{ts,tsx}"],          // was: ["src/ui/**/*.tsx"]
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { "react-hooks": reactHooks },
  rules: { /* unchanged */ },
},
{
  // JSX-shaped rules stay .tsx-only: they match JSXOpeningElement selectors
  files: ["src/ui/apps/**/*.tsx", "src/ui/shell/**/*.tsx"],
  rules: { "no-restricted-syntax": ["error", ...restrictedPrimitives, ...NATIVE_REINVENTIONS] },
},
```

```jsonc
// package.json
"lint:ui": "bunx eslint \"src/ui/**/*.{ts,tsx}\" --max-warnings 0",
```

The second block stays `.tsx`-only deliberately. Its rules are `no-restricted-syntax` selectors
matching `JSXOpeningElement` (`eslint.config.mjs:36`), which cannot match in a file with no JSX, so
widening it would add cost and no coverage.

Test files are the open question. `react-hooks/exhaustive-deps` is a warning and `--max-warnings 0`
makes warnings fatal, so a large test-file backlog could block this plan on unrelated churn. Decide
in step 2 with evidence, not in advance.

## Files

### Modify
- `eslint.config.mjs`: the `files` key at `:43`.
- `package.json`: the `lint:ui` script at `:38`.
- `AGENTS.md:110`: the gate table description, if the final scope differs from "the React shell".
- Whatever `src/ui/**/*.ts` files the newly-enabled rules flag. Fix the violations; do not disable
  the rules.

### Do not touch
- The rule set itself. This plan changes **scope**, not policy. If a rule turns out to be wrong for
  `.ts` files, that is a separate decision with its own rationale.
- `scripts/hooks/**`. The other gates are unaffected.

## Implementation steps

### Step 1: Measure the backlog before committing to it

```bash
bunx eslint "src/ui/**/*.{ts,tsx}" --format=compact | tail -40
bunx eslint "src/ui/**/*.{ts,tsx}" --format=compact | grep -c "Error"
bunx eslint "src/ui/**/*.{ts,tsx}" --format=compact | grep -c "Warning"
```

This runs against the current config, so it reports what the widened scope will surface once the
config `files` key is widened too. Record both counts in the PR before changing anything.

Verify: counts recorded. If errors are zero and warnings are small, this plan is XS. If either is
large, go to the decision in step 2.

### Step 2: Decide the test-file boundary

| Situation | Action |
| --- | --- |
| Backlog is small (say under 20 warnings) | Widen to all `src/ui/**/*.{ts,tsx}` including tests, fix them, done |
| Backlog is large and concentrated in `*.test.ts` | Widen to non-test `.ts` first, add tests in a follow-up, and say so in the PR rather than leaving it implied |
| Backlog is large in production `.ts` | Still widen. A large backlog is the finding, not a reason to skip. Fix in this plan or split with an explicit tracking note |

Never resolve a backlog by raising `--max-warnings`. That converts a real gate into a decorative one
and is the same class of defect this plan exists to fix.

### Step 3: Widen both scopings

Apply the config and script changes. Both, together. Widening only `package.json` does nothing,
which is the trap here.

Verify: `bunx eslint src/ui/apps/workbench/use-variants.ts` no longer prints
"File ignored because no matching configuration was supplied".

### Step 4: Prove the gate can now fail honestly

Re-run the audit's probe. Plant a conditional hook in `src/ui/apps/workbench/use-variants.ts`:

```ts
if (variantsOf(baseDraft).length > 99) {
  useState<string | null>(null);
}
```

Verify: `bun run lint:ui` -> FAILS with `react-hooks/rules-of-hooks`. Record the output. Revert the
probe. This is the single assertion that proves the plan worked; without it the change is unproven.

### Step 5: Clear the backlog

Fix every error and warning the widened scope surfaces. For `exhaustive-deps` findings, fix the
dependency array rather than adding a disable comment, unless the case genuinely matches the
documented mount-once exception already used at `src/ui/shell/App.tsx:283-286`, in which case follow
that precedent including its inline reason.

Verify: `bun run lint:ui` -> EXIT 0.

### Step 6: Full wall

Verify: `bun run verify:ci` -> EXIT 0.

## Test plan

- Baseline: `bun run verify:ci` green at `80451e6`.
- Honest RED: step 4, recorded verbatim. The planted violation must fail `lint:ui`.
- Unchanged GREEN: `lint:ui` clean after reverting the probe.
- Regression: `bun run test` must stay at 2250 pass. Lint fixes that change behavior are a STOP
  condition, not a test to update.
- Broad: `bun run verify:ci`.

## Documentation and operations

- `AGENTS.md:110` currently reads "eslint on the React shell, zero warnings". Make it match the final
  scope, for example "eslint on all authored TS/TSX under src/ui, zero warnings".
- `CLAUDE.md` repeats the gate list; check it too.

## Done criteria

- `bun run verify:ci` -> EXIT 0.
- `bun run lint:ui` covers `.ts` files, proven by step 4's recorded failure.
- Backlog counts from step 1 recorded in the PR, and the final disposition of each stated.
- `--max-warnings 0` is unchanged.
- `bun run test` still reports 2250 pass.
- Independent review returns SHIPPABLE.

## STOP conditions

- A lint fix would change runtime behavior. `exhaustive-deps` fixes can alter effect timing and
  cause real bugs. Stop, isolate that file, and handle it as its own change with its own test.
- The backlog is so large that fixing it in one pass is not reviewable. Split by directory, land the
  scope widening with a documented, dated exclusion list, and never leave the exclusion implicit.
- Widening reveals that `.ts` files legitimately need a different rule set. Stop and re-plan; this
  plan assumes scope, not policy, is wrong.

## Rollback and recovery

Config and lint fixes only. Revert `eslint.config.mjs` and `package.json` to restore the old scope.
Any behavior-neutral lint fixes can stay.

## Maintenance notes

- The failure mode was a glob that silently narrowed a gate. `scripts/hooks/prose-guards.ts` walks
  `docs/ specs/ src/ scripts/ templates/` plus three named root files, and
  `scripts/hooks/doctrines.ts` has its own roots. Those are the same shape of hand-maintained scope
  and are worth the same look; this audit did not check whether they under-cover.
- Reviewer trap: a green `lint:ui` after this change proves nothing on its own. The proof is step 4.
