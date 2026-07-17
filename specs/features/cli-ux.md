# Spec: CLI UX (global flags, help, errors, confirmation, REPL entry, config)

**Package:** `apps/cli` (shared runtime: `apps/cli/src/cli/*`, consumed by every
subcommand) · **Milestone:** M1 (global flags, help, error style, confirmation,
config file) extended by M2 (bare `vaud` REPL entry) · **Status:** draft
**Depends on:** `docs/03-CONVENTIONS.md` (CLI conventions, error classes, output
vocabulary), `docs/02-ARCHITECTURE.md` (productions, faces), ADR-003 (updater
notice etiquette), ADR-006 (BYOK, agent survives weak models), `specs/formats/
escrow-and-roundtrip.md` (report shapes and `--strict` exit behavior consumed by
`vaud convert/validate`), forward references to `specs/features/cli-converter.md`
(command grammar, not yet written), `specs/engine/agent-loop.md` (REPL internals,
not yet written), `specs/engine/key-vault.md` (key storage, not yet written) ·
**VAUDEVILLE reference:** none (this layer has no VAUDEVILLE precedent; `apps/rc`
is a web app, not a CLI)

## Purpose

Defines the UX contract shared by every `vaud` command: the global flag set, how
help text is rendered, how errors are surfaced (human and `--json` modes), when a
destructive action needs confirmation, how the bare `vaud` invocation enters the
agent REPL (M2) versus prints help (M1), and the shape and location of the user
config file. Every subcommand spec (`cli-converter.md`, `script-doctor.md`,
`table-read.md`, etc.) builds its own command surface on top of this contract
instead of inventing its own flag names, error rendering, or confirmation
behavior. An implementing agent building any `vaud` subcommand reads this spec
first for anything that is not specific to that command's own grammar.

## Behavior

### 1. Global flags

Every command accepts this flag set in addition to its own. Flags are parsed
before subcommand-specific flags; an unrecognized global-looking flag (`--xyz`)
is a `UserError`, not silently ignored.

| Flag | Short | Default | Meaning |
|---|---|---|---|
| `--help` | `-h` | — | Print help for the current command (or root) and exit 0. Never touches disk or network. |
| `--version` | — | — | Print `vaud <semver> (<git-sha-short>)` to stdout and exit 0. No short form (reserved to avoid clashing with `-v`/verbose, a common source of CLI confusion). |
| `--json` | — | `false` | Machine-readable **result** to stdout as a single JSON object; human progress/log lines still go to stderr. See "JSON output contract" below. |
| `--yes` | `-y` | `false` | Pre-answer any confirmation prompt with "yes." Required for destructive operations run non-interactively. |
| `--quiet` | `-q` | `false` | Suppress informational stderr lines; warnings and errors still print. Does not affect `--json` stdout. |
| `--verbose` | `-v` | `false` | Print extra stderr diagnostics (file paths touched, timing, the internal `cause` chain on errors). Mutually exclusive with `--quiet` (edge case 13). |
| `--no-color` | — | `false` | Force plain text, no ANSI color/glyph coloring. Auto-forced true when stdout is not a TTY or `NO_COLOR` env var is set (any value), per the `NO_COLOR` convention. Never affects `--json` output, which is never colorized. |
| `--config <path>` | — | `~/.vaud/config.json` | Use an explicit config file instead of the default. If the path is given explicitly and does not exist, this is a `UserError` (edge case 8) — unlike the default path, which is allowed to be absent. |
| `--production <path>`, `-p <path>` | `-p` | resolved (see below) | Target a specific production folder instead of the one auto-detected from `cwd` or the library-mode default. |

Flags follow standard double-dash long-form / single-dash short-form parsing;
`--flag=value` and `--flag value` are both accepted for flags that take a value.
Boolean flags do not take a value; `--json=false` is a `UserError`.

### 2. Command discovery and grouping

`vaud help` (and `vaud --help` / `vaud -h` with no other arguments) prints
commands grouped by function, one line per command, plain-vocabulary summaries
(per `docs/03-CONVENTIONS.md` line 38-40: "converted 3 files," never "the
curtain rises on 3 files" — flavor lives in agent personas, never in scriptable
command output or its help text):

```
vaud <command> [options]

Convert & inspect
  convert     Convert a card, lorebook, preset, or persona between formats
  inspect     Print the canonical shape and escrow report for a file
  validate    Check a file against its format's schema; exit nonzero on failure

Move content
  import      Import a bundle (zip/folder) of mixed content, format-detected
  export      Export a production or file set to one or more target formats

Health
  doctor      Run deterministic (and, with a key, AI) audits over cards

Utility
  upgrade     Check for and install a newer vaud release
  config      Read or set values in ~/.vaud/config.json

Run "vaud <command> --help" for flags and examples on any command.
Run "vaud" with no command to start an interactive session.
```

(Exact command list grows with each milestone; this section documents the
*shape* of the listing, not the frozen final set — command grammar itself is
`cli-converter.md`'s job and later feature specs' job.)

`vaud <command> --help` prints, in order: one-line summary, a `Usage:` line,
a flag table (flag, short, description, default), and 1-3 concrete examples
with a one-line note each — the same register as the CLI-1 wireframe transcript
(`wireframes/cli/cli-and-tui.html`, design-intent reference, not ground truth).
No prose paragraphs, no theatrical framing.

Unknown command (`vaud converrt`) is a `UserError`, exit 1, message names the
unrecognized token and — if within a small edit-distance threshold of a real
command name — suggests the closest match ("no command 'converrt'. did you mean
'convert'?"). No network lookup, no telemetry of the mistyped command.

### 3. Error style

Every internal failure surfaces as one of the typed error classes from
`docs/03-CONVENTIONS.md` ("Errors" section): `FormatError`, `CodecError`,
`ProviderError`, plus two CLI-layer classes this spec adds: `UserError` (bad
input: bad flags, missing files, invalid config) and `InternalError` (a bug —
anything not anticipated). Every error class carries a `userMessage: string`
written in plain prose for a human; internal errors additionally carry a
`cause` that is never shown unless `--verbose`.

**Human mode (default):** the `userMessage` prints to stderr prefixed with the
house glyph for a negative outcome, `-` (per `docs/03-CONVENTIONS.md` line 17:
`+ - · ✦` are the house glyphs; no emoji anywhere). A one-line hint follows on
the next line when the error class provides one (e.g., "run with --yes to
confirm"). `--verbose` appends the `cause` chain (stack or wrapped error) after
that.

**JSON mode (`--json`):** nothing about the error goes to stderr as prose,
except the same progress lines that would print during a successful run
(machine-readable **result**, not machine-readable **logs** — `docs/
03-CONVENTIONS.md` line 35). The final stdout write is a single JSON object:

```json
{
  "ok": false,
  "error": {
    "type": "FormatError",
    "message": "unrecognized PNG chunk order; the tEXt block is missing",
    "hint": "run with --verbose for the full parse trace",
    "code": "PNG_TEXT_CHUNK_MISSING"
  }
}
```

`code` is a stable, greppable machine identifier (SCREAMING_SNAKE_CASE);
`message`/`hint` are the same strings a human would see. Scripts should match
on `code`, never on `message` text.

**Exit codes** (per `docs/03-CONVENTIONS.md` line 36): `0` success, `1` user
error (`UserError`, plus `FormatError`/`CodecError`/`ProviderError` instances
that stem from bad input — a malformed source file is the user's problem, not
the program's), `2` internal error (`InternalError`, uncaught exceptions,
assertion failures). `--json` does not change exit codes; a script can check
the exit code alone without parsing JSON if it only cares about pass/fail.

### 4. Confirmation rules

An operation is **destructive** if it can discard data the user did not
explicitly ask to discard: overwriting an existing output file at a path the
user did not pass `--force`/an explicit unique name for, `vaud history restore`
(replaces current production state), committing a staged agent edit, `vaud
upgrade` (self-replaces the running binary), and any future `doctor --apply`
batch-fix flow (M3). Read-only and additive operations (`inspect`, `validate`,
`convert` to a fresh path, `import` into an empty target) are never destructive
and never prompt.

Resolution order for a destructive operation:

1. `--yes`/`-y` present -> proceed without prompting.
2. Not present, and stdout+stdin are both a TTY -> print a `?`-prefixed prompt
   (house glyph for attention) and block for `y`/`n` (REPL staged edits offer a
   third option, `e`dit — see edge case 10). Any other input reprompts once,
   then treats a second invalid answer as `n`.
3. Not present, and either stdin or stdout is not a TTY (piped, redirected, or
   `--json` is set) -> **never prompt**. Fail immediately as a `UserError`
   ("this is a destructive operation; pass --yes to confirm non-interactively"),
   exit 1 (edge case 4). A machine consumer cannot answer a prompt, so silently
   blocking forever is not acceptable.

### 5. REPL entry (bare `vaud`)

This behavior ships in M2 (`packages/agent` must exist); in M1 binaries, bare
`vaud` (no subcommand, no flags) behaves as `vaud help` and exits 0, because
there is no agent loop yet to enter. Both states are part of this spec: an M1
implementer must not build a placeholder REPL, and an M2 implementer must not
leave the M1 help-only behavior in place.

**M2 behavior:** `vaud` with no subcommand:

- If stdin is a TTY (interactive terminal) -> enters the agent REPL. Resolves
  the active production (flag `-p`/`--production`, else nearest `vaud.json`
  walking up from `cwd`, else library mode — the managed default production;
  see `docs/02-ARCHITECTURE.md` "Productions"), resolves the default persona
  and default model role mapping from config, and prints a one-line banner
  naming production, persona, and model (matches the register of the CLI-2
  "Prompter's Box" wireframe transcript, design-intent reference only:
  `wireframes/cli/cli-and-tui.html`).
- If no key is configured for the model role the first agent turn needs, the
  REPL does not refuse to start — it starts, and the key ceremony (scope of
  `specs/engine/key-vault.md`) runs inline the moment a turn actually needs a
  model call, never before. This matches ADR-006 item 2 ("the first key ask
  happens at the first AI moment, never at install") and the master plan's
  "the brain is optional."
- If stdin is not a TTY (piped or redirected) -> does not silently start an
  interactive loop that can never receive input. Prints the root help to
  stderr and exits 1. Whether piped stdin should instead be read as a single
  one-shot instruction (`echo "do X" | vaud`) is OPEN QUESTION: no spec or
  wireframe defines a batch/one-shot agent mode; do not build it speculatively.
- REPL turns follow the state machine defined in `specs/engine/agent-loop.md`
  (not yet written) and the staged-edit lifecycle from `docs/02-ARCHITECTURE.md`
  ("Staged edits only"); this spec only owns entry, the banner, and confirmation
  styling for the commit step, not turn internals.

### 6. Config file

Location: `~/.vaud/config.json` (Windows: `%USERPROFILE%\.vaud\config.json`),
overridable with `--config <path>` or the `VAUD_CONFIG` environment variable
(flag wins over env var wins over default). The file is never required to
exist: every read falls back to built-in defaults in memory. The CLI never
writes it proactively; it is written only by an explicit `vaud config set ...`
or by the key ceremony completing (which writes model-role-to-provider/model
mappings here, never the key itself — see below).

Proposed schema (no existing implementation to cite; this document is the
first definition of it, per the M1 brief for this spec):

```json
{
  "version": 1,
  "defaultProduction": null,
  "color": "auto",
  "modelRoles": {
    "interview": { "provider": "anthropic", "model": "claude-sonnet" },
    "treatment": null,
    "test": null,
    "audit": null
  },
  "persona": { "default": "the-understudy" },
  "updater": { "channel": "stable", "lastCheckedAt": null }
}
```

Rules:

- `version` is a schema version integer; the loader must refuse (as a
  `UserError`, not a crash) a config with a `version` newer than the running
  binary understands, and must warn-and-ignore-unknown-keys for a config with
  an *older or equal* version that has fields this build no longer recognizes
  (forward/backward compatibility across upgrades — edge case 6).
- **Never stores API keys or any other secret.** Keys live exclusively in the
  OS keychain or the AES-encrypted file fallback (ADR-006, detailed in
  `specs/engine/key-vault.md`). `modelRoles` entries name a provider and model
  string only; resolving that to an actual credential is the vault's job.
- `color` accepts `"auto" | "always" | "never"`; `"auto"` resolves against
  TTY-detection and `NO_COLOR` exactly as `--no-color` does at the flag layer.
  An explicit `--no-color`/`--color` flag (if a future ticket adds the
  positive form) overrides the config value for that invocation only.
- `updater.lastCheckedAt` backs the "at most one non-blocking notice per day"
  rule from ADR-003; the check-and-notice mechanism itself belongs to
  `specs/features/updater.md`. This spec only requires that a version notice,
  when shown, is a single dim stderr line appended after all other output, and
  is fully suppressed under `--json` and `--quiet` (edge case 11).

## Public API sketch

```ts
// apps/cli/src/cli/types.ts

export interface GlobalFlags {
  json: boolean;
  yes: boolean;
  quiet: boolean;
  verbose: boolean;
  noColor: boolean;
  configPath?: string;      // from --config; undefined means "use default resolution"
  production?: string;      // from --production / -p
}

export type ExitCode = 0 | 1 | 2;

export type CliErrorType =
  | "FormatError"
  | "CodecError"
  | "ProviderError"
  | "UserError"
  | "InternalError";

export interface CliError {
  type: CliErrorType;
  code: string;              // SCREAMING_SNAKE_CASE, stable, greppable
  message: string;           // userMessage: plain prose, no jargon
  hint?: string;
  cause?: unknown;           // only ever rendered under --verbose
}

export interface CliResult<T> {
  ok: true;
  data: T;
  warnings?: string[];
}

export type CliOutcome<T> = CliResult<T> | { ok: false; error: CliError };

export type ModelRole = "interview" | "treatment" | "test" | "audit";

export interface VaudConfig {
  version: 1;
  defaultProduction: string | null;
  color: "auto" | "always" | "never";
  modelRoles: Partial<Record<ModelRole, { provider: string; model: string } | null>>;
  persona: { default: string | null };
  updater: { channel: "stable" | "beta"; lastCheckedAt: string | null };
}

/** Loads config from --config, VAUD_CONFIG, or the default path; never throws
 *  for a missing file, throws UserError for an unparseable or too-new one. */
export function loadConfig(explicitPath?: string): Promise<VaudConfig>;

export function saveConfig(config: VaudConfig, explicitPath?: string): Promise<void>;

/** Walks up from cwd for vaud.json; falls back to library mode (null) or the
 *  --production flag if given. Never creates a production as a side effect. */
export function resolveProduction(
  cwd: string,
  flag?: string,
): Promise<{ path: string; mode: "workspace" } | { path: null; mode: "library" }>;

export interface ConfirmOptions {
  message: string;
  flags: Pick<GlobalFlags, "yes" | "json">;
  isTTY: { stdin: boolean; stdout: boolean }; // injectable, for tests
  choices?: "yn" | "yne"; // "yne" adds [e]dit, REPL staged-edit commit only
}

/** Resolves the confirmation rule in "Confirmation rules" above. Resolves to
 *  false only on an explicit "n"; throws CliError("UserError",
 *  "CONFIRMATION_REQUIRED") when non-interactive with no --yes. */
export function confirm(opts: ConfirmOptions): Promise<"y" | "n" | "e">;

/** Single exit point for every command: writes JSON to stdout under --json,
 *  or a human-rendered line to stdout/stderr otherwise; sets process.exitCode
 *  per the exit-code table; never calls process.exit() directly (keeps it
 *  testable). */
export function emitOutcome<T>(outcome: CliOutcome<T>, flags: GlobalFlags): void;

export interface CommandFlagSpec {
  flag: string;         // "--to"
  short?: string;        // "-t"
  description: string;
  default?: string;
  takesValue: boolean;
}

export interface CommandSpec {
  name: string;
  summary: string;                 // one line, plain vocabulary
  group: "convert" | "move" | "health" | "utility" | "agent";
  usage: string;
  flags: CommandFlagSpec[];
  examples: Array<{ cmd: string; note: string }>;
  destructive: boolean;
}

export function renderHelp(root: CommandSpec[], target?: string): string;

/** True iff bare `vaud` (no argv beyond global flags) should attempt REPL
 *  entry rather than print help. False on M1 builds where packages/agent is
 *  not linked, regardless of TTY state. */
export function shouldEnterRepl(argv: string[], stdin: { isTTY: boolean }, agentAvailable: boolean): boolean;
```

## Edge cases & failure modes

1. Bare `vaud` on an M1 binary (no agent package linked): prints root help,
   exit 0. Never attempts REPL, never errors.
2. Bare `vaud` on an M2+ binary with non-TTY stdin (piped/redirected): prints
   root help to stderr, exit 1. Does not silently hang waiting for input that
   can never arrive. Whether a one-shot piped-prompt mode should exist is
   OPEN QUESTION.
3. Unknown subcommand: `UserError`, exit 1, suggests nearest match by edit
   distance if one is close enough; otherwise just lists `vaud help`.
4. Destructive operation requested with `--json` and no `--yes`: fails
   immediately as `UserError` with `code: "CONFIRMATION_REQUIRED"`, exit 1.
   Never attempts to prompt when a TTY is not guaranteed on both ends of
   stdio, and `--json` is treated as evidence of non-interactive use even if
   stdio happens to be a TTY (a human piping through `jq` should not get an
   unexpected blocking prompt).
5. `--quiet` and `--json` together: `--json`'s stdout contract is unaffected;
   `--quiet` still suppresses informational stderr lines (progress). Not a
   conflict, both apply.
6. Config file present but its `version` is newer than the running binary
   understands: `UserError`, exit 1, message names the required minimum `vaud`
   version. Config file with unknown keys but a `version` this build
   understands: load succeeds, unknown keys are preserved on next save (so a
   downgrade-then-upgrade round trip does not lose forward-added fields),
   warning printed only under `--verbose`.
7. Config file present but not valid JSON, or valid JSON that fails the
   config schema (e.g. `color: "purple"`): `UserError`, exit 1, message names
   the exact file path and the offending key/value. Never crashes with a raw
   parse-exception stack trace in non-verbose mode.
8. `--config <path>` given explicitly and the file does not exist: `UserError`,
   exit 1 ("config file not found: <path>"). This differs from the default
   path, which is allowed to be absent (falls back to defaults silently).
9. `--no-color`, the `NO_COLOR` env var, and `--json` can all be present at
   once without conflict: `--json` output is never colorized regardless of the
   other two; `--no-color`/`NO_COLOR` only affect the human-readable stream.
10. REPL staged-edit commit prompt offers `[y]es / [n]o / [e]dit` (matches the
    CLI-2 wireframe transcript); every other confirmation in the product
    (plain commands, `vaud upgrade`, `vaud history restore`) offers only
    `[y]es / [n]o`. The `edit` choice is REPL-only because only the REPL has
    an editable staged-diff object to hand back into; plain commands keep the
    confirmation binary to stay scriptable.
11. Version-check notice (ADR-003, at most one per day): rendered as a single
    dim stderr line appended after all other output in human mode; fully
    suppressed under `--json` and `--quiet`. Never printed before command
    results (a script grepping the first line of stderr must not see it).
12. `--production <path>` conflicts with cwd already being inside a different
    production's folder: the flag wins. Non-REPL commands proceed silently;
    the REPL banner names the production that won so the user is never
    surprised about which production they are editing.
13. `--quiet` and `--verbose` both passed: `UserError`, exit 1, before any
    command work begins ("--quiet and --verbose are mutually exclusive").
14. `-h`/`--help` combined with other flags or a subcommand and its own flags
    (`vaud convert --to json --help`): help for that specific command wins;
    no conversion is attempted, exit 0.
15. A terminal without ANSI support (legacy Windows `cmd.exe` outside Windows
    Terminal): color auto-detection must resolve to off automatically, not
    rely on the user knowing to pass `--no-color`. Exact detection mechanism
    (library or hand-rolled) is an implementation detail of the ticket, not
    this spec; the requirement is behavioral (no escape-code garbage in
    unsupported terminals).

## Test plan

- Config fixtures (`apps/cli/test/fixtures/config/`):
  - `valid-full.json` — every field populated, must load byte-for-byte.
  - `valid-empty.json` — `{"version":1}` alone, must load with all other
    fields defaulted.
  - `invalid-json.json` — truncated/malformed JSON, must produce `UserError`
    with the file path in the message, never an uncaught parse exception.
  - `invalid-schema.json` — valid JSON, bad `color` value, must name the
    offending key.
  - `future-version.json` — `{"version":2}`, must produce `UserError` naming
    a minimum required `vaud` version.
  - `unknown-keys.json` — `version:1` plus an extra top-level key, must load
    and preserve the extra key through a `saveConfig` round trip.
  - missing file (no fixture, just an absent path) — must load defaults with
    no error and no file created.
- Golden CLI transcripts (`apps/cli/test/golden/`), snapshot-tested against
  captured stdout/stderr/exit-code triples:
  - `help/root.txt` — `vaud help` output shape (grouping, one-liners).
  - `help/command.txt` — `vaud convert --help` shape (usage/flags/examples).
  - `errors/unknown-command.txt` — typo suggestion behavior.
  - `errors/destructive-no-yes-human.txt` — interactive-but-no-TTY-injected
    case, human mode.
  - `errors/destructive-no-yes-json.json` — same, `--json` mode, asserts the
    exact `CONFIRMATION_REQUIRED` envelope.
  - `repl/banner-m1-no-agent.txt` — bare `vaud` behaves as help on an M1 build
    (`agentAvailable: false` injected).
  - `repl/banner-piped-stdin.txt` — bare `vaud` with injected non-TTY stdin on
    an M2 build, asserts help-to-stderr + exit 1.
  - `updater/notice-suppressed-json.json` — version notice never appears in a
    `--json` run even when a newer version is injected as available.
- Property/unit tests beyond fixtures/golden transcripts:
  - `confirm()` truth table over the 2x2x2 space of `{--yes present/absent} x
    {stdin TTY/not} x {stdout TTY/not}`, asserting the exact outcome
    ("proceeds," "prompts," or "throws CONFIRMATION_REQUIRED") from
    "Confirmation rules" for all eight combinations.
  - Exit-code mapping: one unit test per `CliErrorType` asserting it maps to
    exit 1 or 2 per the table in "Error style," so a future error class
    cannot be added without deciding its exit code.
  - `NO_COLOR` env var precedence test: env var set, `color: "always"` in
    config, no CLI flag -> color still off (env var is the documented
    convention and must not be silently overridable by a config file the user
    forgot they set).
- Round-Trip Law: not applicable. This spec has no serialization format; it
  governs CLI process behavior, not file codecs.

## Non-goals

- The TUI (`CLI-3`/"The Board Op" in `wireframes/cli/cli-and-tui.html`) is
  explicitly out of scope for this spec and for M1/M2: no roadmap milestone
  commits to it, and the wireframe itself notes it "should come after CLI-1
  and CLI-2 prove out."
- Shell completion scripts (bash/zsh/fish/PowerShell) — future ticket, not
  designed here.
- Localized/translated help text and error messages — English only for now.
- A piped/one-shot batch mode for the agent REPL (`echo "..." | vaud`) — see
  OPEN QUESTION in edge case 2; not designed, not to be built speculatively.
- The actual grammar of `convert`/`inspect`/`validate`/`import`/`export` and
  their flags — that is `specs/features/cli-converter.md`'s job; this spec
  only supplies the global flags and rendering contract those commands sit on
  top of.
- Agent turn internals, tool registry, spill store, staged-edit envelope
  mechanics — `specs/engine/agent-loop.md`'s job; this spec only owns REPL
  entry, the banner, and confirmation styling for the commit step.
- Key storage mechanics (keychain vs encrypted file, the key-ceremony prompt
  copy) — `specs/engine/key-vault.md`'s job; this spec only specifies that
  `modelRoles` in the config file never holds a secret and that the ceremony
  is triggered lazily from REPL entry.

## Sources consulted

- `docs/03-CONVENTIONS.md` (this repo) — CLI conventions section: lines 33-40
  (`--json`, `--yes`, exit codes 0/1/2, plain-first output vocabulary); "Code"
  section lines 14-17 (typed error classes with `userMessage`, house glyphs
  `+ - · ✦`, no emoji, no em dash).
- the master plan (private planning notes) (this repo) — "The Faces" (CLI-first, every feature
  in CLI before app), "AI is optional" locked decision.
- `docs/02-ARCHITECTURE.md` (this repo) — "Productions (project workspaces)"
  section (`vaud.json`, `.vaud/history/`, library mode); "Faces" section
  (plain commands + `vaud` bare = agent REPL); "The agent" section (staged
  edits, tiny tool surface, weak-model survival).
- `docs/decisions/ADR-003-distribution.md` — self-updater etiquette: "at most
  one non-blocking 'new version' notice per day; never auto-install without
  consent."
- `docs/decisions/ADR-006-ai-and-agent.md` — BYOK, "AI is optional... the
  first key ask happens at the first AI moment, never at install," staged
  edits, model-role mapping (interview/treatment/test/audit).
- `docs/ROADMAP.md` — M1 exit criteria (converter CLI, no agent yet) vs M2
  exit criteria (`vaud` bare REPL ships here), used to derive the M1-vs-M2
  split in "REPL entry."
- `specs/formats/escrow-and-roundtrip.md` — `ParseReport`/`SerializeReport`
  and `--strict` exit-nonzero-on-dropped-fields behavior, referenced for how
  `vaud convert/validate` will plug into this spec's exit-code table (their
  own command grammar is out of scope here).
- `templates/SPEC-TEMPLATE.md` — structure this document follows.
- `wireframes/cli/cli-and-tui.html` — design-intent reference only (not listed
  as ground truth in the production bible (private planning notes) for this file): CLI-1
  ("The Stagehand") transcript register for help/output tone; CLI-2 ("The
  Prompter's Box") transcript for the REPL banner shape and the
  `[y]es/[n]o/[e]dit` staged-edit confirmation; CLI-3 ("The Board Op") noted
  explicitly as out of scope per its own wireframe notes.
- `wireframes/identity/first-run.html` — design-intent reference only, App-face
  (M6) first-run doors and key ceremony; consulted to confirm the "key ask
  deferred to first AI moment" principle is consistent across faces, not used
  as a source for CLI-specific behavior since it describes the Studio app, not
  `vaud`.
- NO_COLOR convention (https://no-color.org/) — used for the `NO_COLOR`
  env var behavior in "Global flags" and edge case 9; this is a general CLI
  ecosystem convention, not a Vaudeville-specific invention, cited here for
  the reviewer's benefit rather than fetched (no claim of an exact spec text
  is made beyond "presence of the env var, any value, disables color").
