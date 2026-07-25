# Plan 04: Connect session commands and persistence to the running App

## Status

Implemented and regression-tested on 2026-07-25.

## Outcome

`/session`, `/resume`, `/rewind`, and `/export` are discoverable from the real command registry and
operate on the current persisted session. Unknown slash commands produce local feedback and never
become provider prompts by accident.

## Root cause

Command discovery scans only `src/kit/commands/*.ts`, while session commands live one directory
deeper. App does not create `SessionActions`, load/store a current session, or expose resume/rewind
views. Leaf modules pass isolated tests but no production integration owns the workflow.

## Files and symbols

- `src/kit/commands/discover.ts`
- `src/kit/commands/command.ts`
- `src/kit/sessions/commands/*.ts`
- `src/kit/sessions/session-actions.ts`
- `src/kit/sessions/store.ts`
- `src/kit/sessions/session-model.ts`
- `src/kit/sessions/projection.ts`
- `src/kit/sessions/render/*.tsx`
- `src/kit/render/app.tsx`
- `src/kit/session.ts`
- App-level command/session integration tests
- `docs/reference/kit/sessions.md` (new)

## Target design

Keep folders as schema: recursively discover command modules under declared command roots, with
duplicate-name detection and deterministic ordering. Give App one current session controller that
persists accepted user turns and terminal assistant outcomes atomically. Session commands receive
typed `SessionActions` through command context and open explicit App views. Command parsing
distinguishes plain text, known slash command, and unknown slash command; provide a literal escape
for a prompt intentionally starting with slash.

## Data and compatibility

Reuse the existing versioned session model and store layout. Do not rewrite prior transcripts on
load. If wiring reveals a schema gap, add a forward version and compatibility fixture before writing
new data. Export collision behavior must be deterministic and non-overwriting unless explicitly
confirmed.

## Implementation steps

1. Add RED App tests proving all four session commands are discovered and unknown `/quut` does not
   call `Session.runTurn`.
2. Make command discovery recursive within bounded roots. Fail on duplicate command names and keep
   startup deterministic.
3. Instantiate the existing session store/actions at App startup, create or restore the current
   session, and persist each completed turn through one serialized write path.
4. Extend typed command context with session actions. Wire resume, rewind, and export views/actions
   through the shared navigation contract from Plan 03.
5. Define local unknown-command feedback with suggestions and a documented literal slash escape.
6. Make export names collision-safe with stable session identity or create-exclusive suffixing.
   Choose a Markdown fence longer than any backtick run inside tool arguments or output.
7. Add restart, resume, rewind/fork, and export integration tests using a temporary Hoplight home.
8. Document storage location, command behavior, recovery, and export naming.

## Test plan

- Production discovery includes all session commands exactly once.
- A normal prompt still calls the provider; an unknown slash command does not.
- A completed turn survives App restart with ordering and partial/error state intact.
- Resume changes the current session and subsequent turns append to it.
- Rewind forks at the visible selected turn and never mutates the source session.
- Two exports cannot silently overwrite each other.
- Tool content containing three or more backticks remains inside one valid Markdown code block.
- Malformed session data fails visibly without modifying the original file.

## Done when

The four commands work from a fresh live terminal through restart, focused and full suites pass, and
`bun run verify:ci` passes with truthful session documentation.

## Stop and rollback

Stop if session persistence requires changing the canonical transcript semantics; write an ADR or
schema migration plan first. Roll back registry and App wiring together so commands never remain
discoverable without working actions.
