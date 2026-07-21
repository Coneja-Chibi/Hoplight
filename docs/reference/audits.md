# The audit suite

Runnable UI audits under `scripts/audit/`. They drive the real app in a real browser against a
scratch studio seeded through the real adapters, and they **enumerate the live app at runtime**:
the room list comes from the dock, deck and view lists from the Library's own chip rows, lens
lists from the editor's select. Add an app, a deck view, or a lens and the next run walks it with
no script edits. The one hand-grown file is `walks/promises.ts`, because behavior expectations
are human knowledge: every new feature adds a row there (act, then the observable effect).

## Runs

| Command | What it walks | What it checks |
| --- | --- | --- |
| `bun run audit` | everything below, in order | everything below |
| `bun run audit:rooms` | every dock + catalog app, both themes | style audit per room |
| `bun run audit:library` | every deck x every view, staging bar, delete confirm, context menu | style audit per state |
| `bun run audit:editors` | one piece of every kind in its editor; every write-for lens; binder views; export + book-rules dialogs; the folder inspector | style audit per state |
| `bun run audit:setup` | the first-run wizard, every step, live theme flip, custom accent, final | style audit per step |
| `bun run audit:promises` | the promise table: act, then observable effect | import opens a picker, drops import and raise the count, delete deletes, staging stages, lenses change the page, search filters, updates answer, theme flips, create mints and opens, duplicate mints a sibling, rename sticks |
| `bun run audit:clicks` | EVERY visible enabled clickable in every room, clicked | flags clicks with no observable effect as dead-click suspects (an eyeball list, not auto-fail; Quit/Restart and external links are blocklisted) |
| `bun run audit:legibility:dark` / `:light` | rooms + library + editors pinned to one theme | style audit only |
| `bun run audit:watch` | reruns the quick set (rooms + promises) whenever `src/ui` changes | |

## The style audit (every visited state)

Three exhaustive checks over the full DOM, from `page-audit.ts` (deliberately DOM-bound: the whole
function is serialized into the page and runs there):

- **tiny-text**: any text node under the 10px floor
- **low-contrast**: any text under WCAG AA against its effective background (4.5:1, or 3:1 for
  large/bold text)
- **naked-control**: any button or select wearing browser-default fonts instead of the house
  tokens (the unstyled-component class of regression)

Page errors thrown during a walk are ledgered too.

## Artifacts

Each run writes `audit-out/<run>/`: one screenshot per visited state (`<theme>-<stop>.png`) and
`ledger.json` holding the **visited-state list** and every finding. The visited list is the
coverage claim: anything not on it was not audited. A run exits non-zero when it found anything,
so runs can gate CI.

## Honest boundaries

- A state never rendered is never audited; coverage grows with the walkers, and the ledger names
  exactly what was walked.
- Dead-click detection is heuristic (some no-ops are legitimate); its output is a suspect list
  for review.
- Behavior beyond the promise table is carried by the unit suite, not these walks.
