# Hoplight Kit UI Audit Plans

Audit date: 2026-07-24

Audited revision: `d7c4817cfcebf81869ab83bf1042e7e54acc4bb0`, plus the pre-existing dirty
Kit working tree on `Backstage`. These documents are the only files added by the audit.

Implementation update: Plans 01-04 and the non-security portion of Plan 05 were completed and
regression-tested on 2026-07-25. Security-related Plan 05 work remains intentionally deferred.
Plan 06 is a non-security architecture plan for the 100-plus content-operation surface and tool loop.

## Recommended order

1. [01-turn-lifecycle.md](01-turn-lifecycle.md)
2. [02-composer-state.md](02-composer-state.md)
3. [03-terminal-navigation.md](03-terminal-navigation.md)
4. [04-session-integration.md](04-session-integration.md)
5. [05-provider-settings.md](05-provider-settings.md)
6. [06-kit-content-tool-lifecycle.md](06-kit-content-tool-lifecycle.md)

Plans 1 and 2 both touch `src/kit/render/app.tsx` and composer integration tests, so execute them
in order. Plans 3 and 4 both touch the application view controller and should also be serialized.
Plan 5 is mostly independent, but its final App refresh change should be rebased after plans 1-4.
Plan 6 depends on the stable turn, composer, navigation, and session lifecycle from plans 1-4. Its
lorebook vertical slice must ship before the remaining content-kind slices.

The evidence and prioritization are in [AUDIT.md](AUDIT.md).
The external research and Orison comparison for Plan 6 are in
[PROFESSIONAL-TOOLFLOW-REFERENCE.md](PROFESSIONAL-TOOLFLOW-REFERENCE.md).
