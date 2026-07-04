# ADR-002: License — AGPL-3.0-or-later with dual licensing

**Status:** accepted (recommended by Claude, standing until Chi overrules)

## Chi's requirement

"I don't want ANYONE profiting off this. Except me. But I want people to use it.
A standard license that gives me control without looking like a control freak."

## Decision

- **AGPL-3.0-or-later** for the whole repo.
- **Dual licensing:** Chi (copyright holder) may sell commercial licenses to anyone
  who can't or won't comply with AGPL. This is the Grafana/Qt/MongoDB(pre-SSPL) model.
- **CLA (Contributor License Agreement)** required on every external contribution,
  assigning Chi the right to relicense. Without this, dual licensing dies the day the
  first outside PR merges. Use a bot (cla-assistant) from day one.

## Why AGPL satisfies the requirement

- It is a real, OSI-approved open-source license: nobody credibly calls an AGPL
  project a control freak's project.
- In practice it prevents closed commercial exploitation: any fork or hosted service
  must publish its complete source under AGPL, which commercial actors almost never
  accept, so they either stay away or buy a commercial license from Chi.
- Chi, as copyright holder, is not bound by it: RoleCall can use any of this code in
  its closed codebase freely (for Chi's own code; contributor code is covered by
  the CLA).

## Rejected alternatives

- **PolyForm-NC / FSL / BUSL:** closer to the literal requirement but source-available,
  not open source; invites exactly the community suspicion Chi wants to avoid.
- **MIT/Apache:** allows closed commercial forks outright.
- **MIT core + AGPL app:** cleaner adoption story for the engine, but weakens the
  no-profit guarantee where it's most valuable; can be revisited per-package later
  (relicensing MIT-ward is always possible for the copyright holder; the reverse
  is not).

## Consequences

- `LICENSE` (AGPL-3.0), `LICENSING.md` (plain-English explanation + commercial
  contact), CLA bot config, and a per-file SPDX header convention: all part of M0.
