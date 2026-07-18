<div align="center">

<img src="docs/media/vaudeville-v.png" alt="" width="56">

<sub>· A CONEJA-CHIBI PRODUCTION ·</sub>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/media/hoplight-wordmark-dark.png">
  <img src="docs/media/hoplight-wordmark-light.png" alt="Hoplight" width="320">
</picture>

</div>

---
# Contributing

Contributions are welcome: bug fixes, new format adapters, docs, sample files.

## Ground rules

- **AI-written code is fine. Name the model in your PR.** Different models have different failure
  types and vulnerabilities I look out for when inspecting their code. "Claude Sonnet 4.5",
  "GPT-5", "wrote it myself", all valid answers.
- **All tests pass, and new features bring their own.** Run `bun test` before you open the PR. A
  new feature without tests doesn't merge; a bug fix needs a test that fails without the fix.
- **Follow the house rules.** [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) is the law. The
  short version: no hardcoded values (colors come from theme tokens, magic literals get names),
  500 lines per file maximum, one concept per file, shared logic extracted exactly once, and new
  surfaces built as drop-in folders next to their siblings, never wired into a central list.
- **The gates are not negotiable.** CI runs ~1,950 tests plus the round-trip law, a color-token
  guard, the 500-line file cap, prose gates, and a license audit. If a gate fails, the PR waits.
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
