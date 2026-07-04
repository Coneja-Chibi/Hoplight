# Vaudeville Studios — Planning Repo

The complete planning suite for **Vaudeville Studios**: an open (AGPL), local-first
creator studio for AI-roleplay content. Character cards, lorebooks, presets, personas,
regex scripts, worlds. Every format (SillyTavern, Risu, Backyard, RoleCall, Lumiverse,
Agnai), every surface (CLI, agent, desktop app), AI-assisted end to end, BYOK.

Built by Chi (RoleCall Studios). This folder is the source of truth that implementing
agents (and humans) work from.

## Read order

| # | File | What it is |
|---|------|-----------|
| 1 | `docs/00-MASTER-PLAN.md` | The whole project, start to ship, in one document |
| 2 | `docs/01-VISION.md` | What we're building and why it wins |
| 3 | `docs/02-ARCHITECTURE.md` | Monorepo, packages, engine, faces |
| 4 | `docs/decisions/` | ADRs: every locked decision + reasoning |
| 5 | `docs/03-CONVENTIONS.md` | Code style, testing law, repo rules |
| 6 | `docs/04-AGENT-PLAYBOOK.md` | **Implementing agents: read this before any ticket** |
| 7 | `docs/05-EXTRACTION-MAP.md` | What we lift from VAUDEVILLE and from where |
| 7.5 | `docs/07-BASE-VS-SCRATCH.md` | The fork-vs-build verdict + the locked dependency stack |
| 8 | `docs/ROADMAP.md` | Milestones M0-M7 with exit criteria |
| 9 | `specs/` | Format, engine, and feature specifications |
| 10 | `tickets/` | Implementation tickets, grouped by milestone |

## Status

- Wireframes in `wireframes/` are **draft I — rejected**. Visual direction is being
  re-explored separately (evolving the VVS style). Nothing in `specs/` or `tickets/`
  depends on a layout decision; the studio app face (M6) is the only layout-coupled
  milestone.
- Product name: **Vaudeville Studios**. CLI binary: **`vaud`**.
- v0.1 ships **The Converter** (see `docs/ROADMAP.md`).
