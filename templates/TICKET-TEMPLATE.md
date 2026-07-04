# VS-<number>: <Title>

**Milestone:** M<n> · **Package:** `packages/<name>` or `apps/<name>`
**Depends on:** VS-<numbers, or "none"> · **Blocks:** VS-<numbers, or "none">
**Size:** S (one sitting) | M (one session) | L (split candidate)

## Context

2-4 sentences: where this fits, why now. Link the spec sections that govern it.

## Read first

Ordered list of exact files the implementing agent must read:
1. `docs/04-AGENT-PLAYBOOK.md` (always)
2. <spec file(s)>
3. <VAUDEVILLE source paths if extraction is involved>
4. <existing code in this repo it must integrate with>

## Task

Numbered, concrete steps. Each step verifiable. No step says "appropriately" or
"as needed."

## Acceptance criteria

- [ ] Checkbox list. Each one objectively testable.
- [ ] "Tests exist for X and pass" entries are mandatory, not implied.

## Test plan

Exactly which tests/fixtures to add or extend, and the command(s) to run.

## Out of scope

Explicit list. The agent must not touch these even if tempting.

## Hints

Gotchas, known traps, line references, naming expectations. Anything that saves
the agent a wrong turn.
