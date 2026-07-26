# Hoplight Kit UI Audit Plans

Audit date: 2026-07-24

Audited revision: `d7c4817cfcebf81869ab83bf1042e7e54acc4bb0`, plus the pre-existing dirty
Kit working tree on `Backstage`. These documents are the only files added by the audit.

Implementation update: Plans 01-04 and the non-security portion of Plan 05 were completed and
regression-tested on 2026-07-25. Security-related Plan 05 work remains intentionally deferred.
Plan 06 is a non-security architecture plan for the 100-plus content-operation surface and tool loop.
Plan 07 (semantic documentation catalogue) and Plan 08 (enforcement repair) were completed on
2026-07-25. Sidecars and independent APPROVE receipts exist for all 86 pages. Discovery is
folder-derived; global check and index merge require current approval; Kit tests are inside
`verify:ci`.
Plans 09 through 12 record the 2026-07-25 creative-studio tool-surface audit. Plan 09 was completed
and regression-tested on 2026-07-25. Plans 10 and 11 are now unblocked and may proceed
independently. Plan 12 remains blocked until the production history engine exists.
Plan 13 is the serial-worker and independent-review contract for complete SillyTavern and Marinara
authoring compendiums using the existing folder-derived semantic catalogue.

## Recommended order

1. [01-turn-lifecycle.md](01-turn-lifecycle.md)
2. [02-composer-state.md](02-composer-state.md)
3. [03-terminal-navigation.md](03-terminal-navigation.md)
4. [04-session-integration.md](04-session-integration.md)
5. [05-provider-settings.md](05-provider-settings.md)
6. [06-kit-content-tool-lifecycle.md](06-kit-content-tool-lifecycle.md)
7. [07-build-semantic-docs-catalogue.md](07-build-semantic-docs-catalogue.md)
8. [08-fix-semantic-docs-enforcement.md](08-fix-semantic-docs-enforcement.md)
9. [09-generalize-kit-tool-runtime.md](09-generalize-kit-tool-runtime.md)
10. [10-add-lifecycle-publishing-tools.md](10-add-lifecycle-publishing-tools.md)
11. [11-add-diagnostics-and-editor-parity.md](11-add-diagnostics-and-editor-parity.md)
12. [12-build-history-backed-batch-tools.md](12-build-history-backed-batch-tools.md)
13. [13-build-platform-authoring-compendiums.md](13-build-platform-authoring-compendiums.md)

Plans 1 and 2 both touch `src/kit/render/app.tsx` and composer integration tests, so execute them
in order. Plans 3 and 4 both touch the application view controller and should also be serialized.
Plan 5 is mostly independent, but its final App refresh change should be rebased after plans 1-4.
Plan 6 depends on the stable turn, composer, navigation, and session lifecycle from plans 1-4. Its
lorebook vertical slice must ship before the remaining content-kind slices.
Plan 7 depends on Plan 6's built docs query. It keeps summary authorship separate from deterministic
catalog generation and should be executed as one infrastructure phase, one serial resumable corpus
phase, and one independent review phase.
Plan 8 is the executor-ready repair for Plan 7's enforcement review. It makes current approval part of
CI, discovers new docs without trusting a stale generated index, prevents unapproved semantic metadata
from entering generated navigation, improves repair messages, and brings all Kit tests into the wall.
Plan 9 generalized the existing progressive-disclosure catalog, made reads traversable, and made
composed drafts inspectable. Plans 10 and 11 add lifecycle, publishing, deterministic diagnostics,
and remaining semantic editor parity. Plan 12 must not begin until the production snapshot and
history contracts have a real implementation and recovery tests.
Plan 13 is independent of Plans 10-12. Its lower-cost serial worker authors source-grounded platform
pages and sidecars only; a different reviewer must approve them before regeneration and full CI.

The evidence and prioritization are in [AUDIT.md](AUDIT.md).
The external research and Orison comparison for Plan 6 are in
[PROFESSIONAL-TOOLFLOW-REFERENCE.md](PROFESSIONAL-TOOLFLOW-REFERENCE.md).
