/**
 * The arithmetic behind Kit's live transcript widgets, ported exactly.
 *
 * ONE-TO-ONE, not "something similar". Every constant here is the number from
 * src/kit/render/primitives, because these timings are the widget: the stagehand's dot breathes on
 * a 1.6 second cycle, its verb turns over every 5.2 seconds, its dots step every 800ms. Rounded to
 * "about a second" they stop reading as the same object, and somebody watching a turn in the
 * terminal and a turn in the window would be watching two different programs.
 *
 * Pure so the timings can be asserted rather than eyeballed - the whole point of pulling them out.
 */

/**
 * The stagehand's lowercase stage verbs, in Kit's order.
 *
 * NO PROVIDER NAME, EVER. Kit's own note. While a turn runs, the transcript says what the STAGE is
 * doing, not who is being billed for it, and the elapsed clock carries the only hard fact.
 */
export const STAGE_VERBS = ["cueing", "rifling", "staging", "rehearsing", "consulting"] as const;

/** The dot's breath: dim to bright and back, one step every 400ms, so a full cycle is 1.6s. */
export const BREATH_STEP_MS = 400;
export const BREATH_INKS = ["--kit-mut", "--kit-rose-deep", "--kit-rose", "--kit-rose-deep"] as const;

/** How long one verb holds the stage. */
export const VERB_HOLD_MS = 5200;
/** The trailing dots step at this interval, cycling one to three. */
export const DOT_STEP_MS = 800;

/** The freshest slice of a live thought that is shown, roughly six rows of a pane. */
export const REHEARSAL_TAIL = 380;

/** Kit's clock: minutes and zero-padded seconds, floored, never negative. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
}

/** Which breath ink the dot wears at this point in a turn. */
export function breathInk(elapsedMs: number): string {
  const at = Math.max(0, Math.floor(elapsedMs / BREATH_STEP_MS));
  return `var(${BREATH_INKS[at % BREATH_INKS.length] ?? "--kit-rose"})`;
}

/** The verb on stage, and the dots after it. */
export function stageLabel(elapsedMs: number): string {
  const at = Math.max(0, elapsedMs);
  const verb = STAGE_VERBS[Math.floor(at / VERB_HOLD_MS) % STAGE_VERBS.length] ?? "cueing";
  const dots = ".".repeat((Math.floor(at / DOT_STEP_MS) % 3) + 1);
  return `${verb}${dots}`;
}

/**
 * The tail of a live thought.
 *
 * BY CODE POINT, not by UTF-16 unit. Slicing a string in the middle of a surrogate pair leaves half
 * a character, which renders as a replacement glyph - and reasoning traces are exactly the text
 * most likely to carry emoji and CJK, because they quote whatever the user is working on.
 */
export function rehearsalTail(text: string, cap = REHEARSAL_TAIL): string {
  const points = [...text];
  return points.length <= cap ? text : points.slice(-cap).join("");
}

/**
 * What a landed rehearsal trace says when it is folded.
 *
 * Kit's line exactly: how long it took, how much there was, and how to get it back. Tucked under
 * the turn as one indented row rather than "related things taking up one whole megablock".
 */
export function traceSummary(seconds: number, chars: number): string {
  return `rehearsed for ${String(Math.max(0, Math.round(seconds)))}s · ${String(chars)} chars · click to reopen`;
}
