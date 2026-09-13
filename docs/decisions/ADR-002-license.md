# ADR-002: License, AGPL-3.0-or-later

**Status:** accepted

## Context

The project needed a license that keeps the code genuinely open and usable by anyone, while
preventing a third party from closing it up and selling it. Those two goals pull against each other
under a permissive license, which is what forced a decision rather than a default.

## Decision

**AGPL-3.0-or-later** for the whole repo.

The copyright holder retains the right to sell commercial licenses to anyone who cannot or will not
comply with the AGPL. This is the model Grafana, Qt, and pre-SSPL MongoDB used.

## Why AGPL fits

- It is a real, OSI-approved open-source license. It carries no source-available stigma.
- It prevents closed commercial exploitation in practice: any fork or hosted service must publish
  its complete source under the same terms, which commercial actors rarely accept. They either stay
  away or negotiate a separate license.
- The copyright holder is not bound by their own license, so the same code can still be used in
  their other closed projects.

## Rejected alternatives

- **PolyForm-NC / FSL / BUSL:** closer to the literal requirement, but source-available rather than
  open source. That invites exactly the community suspicion this choice exists to avoid.
- **MIT / Apache:** allows closed commercial forks outright.
- **MIT core plus AGPL app:** a cleaner adoption story for the engine, but it weakens the guarantee
  where it matters most. Revisitable per-package later; relicensing toward MIT is always open to the
  copyright holder, and the reverse is not.

## Consequences

- `LICENSE` carries the verbatim AGPL-3.0 text; `LICENSING.md` explains it in plain terms and
  carries the commercial contact.
- `bun run license:audit` fails the build if a copyleft or restricted dependency is introduced.
- **No CLA is in place, and this is a live constraint.** Dual licensing depends on the copyright
  holder owning all the code. The first merged outside contribution without a contributor agreement
  ends that, because the project could no longer relicense the whole work. Until a CLA exists,
  outside contributions cannot be merged without forfeiting the commercial-licensing option.
- Per-file SPDX headers were considered and are not adopted. The repo-level `LICENSE` governs.
