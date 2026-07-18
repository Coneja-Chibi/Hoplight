# Real-sample corpus (round-trip test fixtures)

Real, downloaded files - one or more per format - used to prove that each codec exposes EVERY authored
field as first-class editable schema (not escrow) and round-trips losslessly. These are NOT hand-authored
fixtures: they are genuine exports pulled from public sources, so the tests measure against reality.

Rule (see docs/02-ARCHITECTURE.md): a format is "done" only when every authored field
in its real sample survives to an editable canonical slot. Scripts/behavior count as authored content.

## Layout

`samples/<format>/<name>.<ext>` (and `samples/lorebooks/<platform>/` for the lorebook corpus) plus a `SOURCES.md` per folder recording the exact download URL + date +
what makes the sample useful (which rich fields it exercises). Keep samples small where possible; large or
licensing-sensitive files are referenced by URL in SOURCES.md and downloaded on demand, not committed.
