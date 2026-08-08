/**
 * The history of what Kit has done to itself.
 *
 * APPEND-ONLY, AND NOT THE SOURCE OF TRUTH. The state is what Kit knows; this is how it came to know
 * it. Keeping them apart is what lets the history be complete without the state having to carry
 * every version of everything it has ever held.
 *
 * A BAD LINE COSTS ONE LINE. Prime Agent's reader skips malformed entries with the note that a
 * single bad append must not break rollback, and that is exactly right: the file is written one line
 * at a time, a crash mid-write is a normal thing to survive, and refusing the whole history over a
 * truncated tail would throw away the record precisely when something has already gone wrong.
 *
 * REFUSALS ARE RECORDED. This is ours; their journal has no declined outcome because nothing can
 * decline. Without it Kit would propose the same rejected memory every session, and being asked the
 * same question forever is its own kind of broken.
 */
import type { HarnessEvent, HarnessOutcome } from "./harness-core";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const OUTCOMES: ReadonlySet<string> = new Set(["applied", "declined", "failed"]);

/** One journal line, or null for anything that is not one. Never throws. */
export function parseEvent(raw: unknown): HarnessEvent | null {
  if (!isRecord(raw)) return null;
  const { id, at, trigger, evidence, outcome, changes, rollbackOf } = raw;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof at !== "string" || at.length === 0) return null;
  if (typeof outcome !== "string" || !OUTCOMES.has(outcome)) return null;
  return {
    id,
    at,
    trigger: typeof trigger === "string" ? trigger : "",
    evidence: typeof evidence === "string" ? evidence : "",
    outcome: outcome as HarnessOutcome,
    changes: Array.isArray(changes) ? changes.filter((c): c is string => typeof c === "string") : [],
    ...(typeof rollbackOf === "string" ? { rollbackOf } : {}),
  };
}

/**
 * Read a whole journal, skipping what cannot be read.
 *
 * The count of skipped lines comes back rather than being swallowed: a history quietly missing
 * entries is worse than one that says how much of itself it could not read.
 */
export function readJournal(text: string): { events: HarnessEvent[]; skipped: number } {
  const events: HarnessEvent[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      skipped += 1;
      continue;
    }
    const event = parseEvent(parsed);
    if (event) events.push(event);
    else skipped += 1;
  }
  return { events, skipped };
}

/** One line, newline-terminated, ready to append. */
export const journalLine = (event: HarnessEvent): string => `${JSON.stringify(event)}\n`;

/**
 * Has this already been turned down?
 *
 * Compared on EVIDENCE rather than on wording, because the model will rephrase a proposal it still
 * believes in, and the point is to stop it asking again about the same observation. Kit may still
 * raise it if something new happens - that would be different evidence.
 */
export function alreadyDeclined(events: readonly HarnessEvent[], evidence: string): boolean {
  const needle = evidence.trim().toLowerCase();
  if (needle.length === 0) return false;
  return events.some((e) => e.outcome === "declined" && e.evidence.trim().toLowerCase() === needle);
}

/**
 * The event a rollback would undo, or null when there is nothing to undo.
 *
 * Only APPLIED events can be rolled back, and only once: rolling back a rollback is a new decision
 * somebody should make deliberately rather than something that unwinds by pressing the same key.
 */
export function rollbackTarget(events: readonly HarnessEvent[], id: string): HarnessEvent | null {
  const target = events.find((e) => e.id === id);
  if (!target || target.outcome !== "applied") return null;
  const undone = events.some((e) => e.rollbackOf === id && e.outcome === "applied");
  return undone ? null : target;
}
