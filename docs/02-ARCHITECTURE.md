# Architecture

Hoplight is a Bun and TypeScript application rooted in `src/`. The canonical engine is shared by
three surfaces: the command-line interface, the loopback React Studio, and Kit's terminal interface.
No surface owns a private format conversion path.

For the detailed source map and current contracts, read
[the architecture reference](reference/architecture.md).

## Source boundaries

```text
src/core        canonical wrapper, adapters, detection, conversion reports, shared engines
src/entities    one rich canonical body and semantic capability family per content kind
src/formats     discovered platform adapters; every format maps through canonical entities
src/studio      local JSON persistence, path containment, atomic writes, settings
src/sandbox     opt-in Lua and regex test benches with bounded worker execution
src/ui          loopback server, HTTP boundary, React Studio, desktop shell
src/kit         provider-backed terminal agent, tools, sessions, staged changes
src/cli.ts      scriptable command-line surface over the same engine
```

Dependencies point inward. Core and entity logic do not import UI or persistence. Formats depend on
canonical contracts. CLI, Studio, and Kit orchestrate those contracts and own their effects.

## Canonical model and formats

Every supported format maps to and from one canonical superset model. There are no format-to-format
converters. An imported piece stores:

- its canonical body, where portable authored meaning lives;
- an escrowed source snapshot and unmapped fields, where format-specific material survives;
- optional profiles for sparse per-application differences.

Same-format export reprojects canonical edits onto the escrowed source. Cross-format export carries
only fields the target can represent and reports what remains escrowed, shadowed, or dropped.

Format adapters are folder-discovered under `src/formats/`. Adding a format means adding one adapter
folder and its tests, fixtures, coverage declaration, and reference documentation. The live registry
drives detection, CLI listings, Studio format choices, Press targets, and the generated support
matrix.

## Storage and mutation

The Studio folder is the database: one canonical JSON file per entity under
`<studio>/<kind>/<id>.json`. `src/studio` owns path policy, atomic replacement, keep-both naming, and
revision-checked compare-and-save.

Editors and Kit capabilities preview pure canonical changes first. Durable apply is separate: it
checks the stored revision, writes atomically, re-reads the result, and reports success only after the
saved entity validates.

## The three surfaces

- `hoplight`: inspect, validate, label, convert, enumerate formats, and start the Studio.
- Studio: the packaged React UI served by a loopback Bun server and wrapped by the desktop executable
  on Windows. Remote listeners exist only through the separately enabled remote-access flow.
- Kit: an active-development terminal interface available from a source checkout with
  `bun run kit`. Kit can call a user-configured model provider, discover bounded tools, stage changes,
  and require explicit apply.

Kit is not included in the current GitHub release binaries. It becomes a release surface only when
cross-platform build and live terminal smoke gates ship with it.

## Effects and trust boundaries

Untrusted files are parsed at storage, HTTP, and conversion boundaries. Imported scripts remain data.
Lua and regex execution occur only inside the user-invoked, bounded test benches.

Network access is deliberate and scoped:

- Studio HTTP stays on loopback unless the user explicitly enables remote access.
- Provider-backed Kit requests check their initial URL against the configured endpoint host. The
  current fetch path does not revalidate runtime redirects, so this is not an end-to-end redirect
  policy.
- Update checks and version switches use fixed GitHub release endpoints.
- Hoplight has no account, telemetry service, inference proxy, or background content upload.

Provider credentials are encrypted at rest by Kit's local vault and used only as authentication to
the configured endpoint. They are excluded from canonical pieces, prompts, tool observations,
exports, transcripts, and the privacy ledger.

## Decisions and future systems

Accepted decisions start with [ADR-001](decisions/ADR-001-runtime.md). Detailed future behavior belongs in
`specs/` and remains planned until source, tests, and a user entry point exist. A specification is not
evidence that a feature ships.
