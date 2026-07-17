# Vaudeville Studios

Local-first forge for AI-roleplay content. Convert, inspect, and edit character cards, lorebooks, and more
(SillyTavern, Risu, Backyard, RoleCall, Lumiverse, Agnai, …). CLI + desktop studio. AGPL-3.0-or-later.

**Status (2026-07-09):** M0 Foundation jewel **DONE**. M1 Converter jewel **DONE** (v0.1). Character-card
platform forge **CLOSED**. See `docs/ROADMAP.md`.

## Quick start (stranger path, under 3 minutes)

Requires [Bun](https://bun.sh) ≥ 1.3.

```bash
git clone <this-repo>
cd vaudeville-studios
bun install

# What can we open?
bun run vaud formats

# Peek at a card
bun run vaud validate samples/sillytavern/v3-full.json
bun run vaud inspect samples/sillytavern/v3-full.json

# Convert ST JSON → Risu .charx
bun run vaud convert samples/sillytavern/v3-full.json out.charx --to risu

# Studio UI (local only)
bun run dev
```

Format matrix (auto-generated): **[docs/FORMAT-SUPPORT.md](docs/FORMAT-SUPPORT.md)**  
Regen after adapter changes: `bun run matrix`

## CLI

| Command | Purpose |
| --- | --- |
| `vaud convert <in> <out> [--to id]` | Convert formats |
| `vaud inspect <file>` | Summary of a file |
| `vaud validate <file>` | Detect + parse; exit 0 if openable |
| `vaud label <file>` | Guess format + likely origin |
| `vaud formats` | List adapters |
| `vaud ui [port] [studioDir]` | Local studio |

`--json` on inspect/validate/formats/convert for machine output.

```bash
bun run build:cli    # compile dist/vaud (or .exe on Windows)
```

## Tests & gates

```bash
bun run test         # full src suite
bun run test:m0      # foundation smoke
bun run test:m1      # multi-platform convert smoke
bun run typecheck
bun run license:audit
```

CI: `.github/workflows/ci.yml`

## Docs (read order)

| File | What |
| --- | --- |
| [`docs/01-VISION.md`](docs/01-VISION.md) | What this is for, and who for |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | The canonical model, and how adapters hang off it |
| [`docs/03-CONVENTIONS.md`](docs/03-CONVENTIONS.md) | Code style and the rules the hooks enforce |
| [`docs/FORMAT-SUPPORT.md`](docs/FORMAT-SUPPORT.md) | Which platforms are supported, and how completely |
| [`docs/reference/`](docs/reference/README.md) | Per-format and per-entity reference |
| [`docs/decisions/`](docs/decisions/ADR-001-runtime.md) | Why the consequential choices went the way they did |

## Character cards

Portable default: **SillyTavern / CCv3**. Rich platforms (Chub, Lumi, Agnai, Risu Workshop, …) have
native editors in the studio. C.AI dropped / Crushon skipped as host-native bags; use Default CCv3.

## License

AGPL-3.0-or-later. Dependencies must stay permissive (`bun run license:audit`).
