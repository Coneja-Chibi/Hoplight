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

Contributions are welcome, including bug fixes, format adapters, documentation, and sample files.

I'm glad you're here. Let's all make Hoplight the best it can be!

## Ground rules

- **AI-assisted contributions are welcome.** Name the model in your PR so reviewers have useful
  context. "Claude Sonnet 4.5," "GPT-5," and "wrote it myself" are all valid answers.
- **Include appropriate verification.** Run `bun test` before opening a PR. Behavior changes should
  include tests when practical; if a test is not practical, explain how the change was checked.
- **Follow the project conventions.** [docs/03-CONVENTIONS.md](docs/03-CONVENTIONS.md) covers the
  details. In brief: use theme tokens for colors, keep files under 500 lines, keep each file focused,
  extract shared logic once, and add new surfaces through the project's drop-in folder patterns.
- **Help keep CI green.** CI checks the test suite, round-trip behavior, color tokens, file size,
  documentation, and dependency licenses. If a check fails, its output should point to the fix.
- **Explain new dependencies.** Include the package and why it is useful in the PR. The license audit
  rejects restricted licenses, and reviewers may suggest a small local helper when that is simpler.

## Adding a platform format

Formats are drop-in folders. Copy `src/formats/_template/`, implement detect/read/write plus a
coverage declaration, and add representative sample files for the round-trip suite. Feel free to
open an issue first if you want help coordinating the format or gathering samples.

## Security issues

Please follow [SECURITY.md](SECURITY.md) and email chibiconeja@gmail.com privately rather than opening
a public issue.

## Setup

```bash
bun install
bun test        # the suite
bun run dev     # the studio, loopback only
```
