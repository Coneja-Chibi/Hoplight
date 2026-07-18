# Contributing

Contributions are welcome: bug fixes, new format adapters, docs, sample files.

## Ground rules

- **AI-written code is fine. Name the model in your PR.** Different models have different failure
  types and vulnerabilities I look out for when inspecting their code. "Claude Sonnet 4.5",
  "GPT-5", "wrote it myself", all valid answers.
- **Tests or it didn't happen.** Run `bun test` before you open the PR. New behavior needs a test;
  bug fixes need a test that fails without the fix.
- **The gates are not negotiable.** CI runs ~1,950 tests plus the round-trip law, a color-token
  guard, a 500-line file cap, prose gates, and a license audit. If a gate fails, the PR waits.
- **No new dependencies without a reason.** The license audit blocks copyleft/restricted licenses
  automatically; beyond that, a five-line helper beats a package.

## Adding a platform format

Formats are drop-in folders. Copy `src/formats/_template/`, implement detect/read/write plus a
coverage declaration, and add real sample files: the round-trip suite runs against them and tells
you whether your adapter is honest. Open an issue with sample files first if you want the format
but not the work.

## Security issues

Not here. See [SECURITY.md](SECURITY.md): email chibiconeja@gmail.com privately first.

## Setup

```bash
bun install
bun test        # the suite
bun run dev     # the studio, loopback only
```
