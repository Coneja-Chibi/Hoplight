/**
 * Kit's live transcript widgets, in the window.
 *
 * THE STAGEHAND, THE REHEARSAL, THE SEARCHLIGHT, THE WATCHER. These are the parts of Kit that are
 * not colour: what it does while it is working, and how it distinguishes speech from everything
 * that is not speech. A transcript with Kit's palette but a plain "Thinking..." is wearing the
 * costume without doing the play.
 *
 * The timings live in kit-widgets-core.ts and are Kit's own numbers, not approximations of them.
 */
import { useEffect, useState, type JSX } from "react";
import { breathInk, clockText, rehearsalTail, stageLabel, traceSummary } from "./kit-widgets-core";

/** Re-render on a fixed beat so the animated widgets step. Kit polls; so does this. */
function useBeat(ms: number, on: boolean): void {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => { tick((n) => n + 1); }, ms);
    return () => { clearInterval(timer); };
  }, [ms, on]);
}

/**
 * The stagehand: the hushed in-transcript line while Kit is out working.
 *
 * A rose dot breathing, a lowercase stage verb turning over, stepping dots, and the elapsed clock
 * as a small deep-rose stamp with white digits. No provider name, which is Kit's rule and a good
 * one: while you are waiting, who is being billed is not the thing you are waiting to learn.
 */
export function Stagehand({ startedAt }: { startedAt: number }): JSX.Element {
  useBeat(200, true);
  const elapsed = Date.now() - startedAt;
  return (
    <div className="kit-stagehand">
      <span className="kit-stagehand__dot" style={{ color: breathInk(elapsed) }}>{"·"}</span>
      <span className="kit-stagehand__verb">{stageLabel(elapsed)}</span>
      <span className="kit-stamp">{clockText(elapsed)}</span>
    </div>
  );
}

/**
 * The open rehearsal: the model's reasoning while it is still happening.
 *
 * Capped to the freshest slice, because the point is watching it think rather than reading a
 * transcript of the thought - that lands afterwards as a trace. THE STAGEHAND NEVER SHARES THE
 * STAGE WITH THIS BOX, which is why the caller shows one or the other and never both.
 */
export function Rehearsal({ text, startedAt }: { text: string; startedAt: number }): JSX.Element {
  useBeat(250, true);
  return (
    <div className="kit-rehearsal">
      <div className="kit-rehearsal__head">
        <span>{"REHEARSAL"}</span>
        <span className="kit-stamp">{clockText(Date.now() - startedAt)}</span>
      </div>
      <p className="kit-rehearsal__text">{rehearsalTail(text)}</p>
    </div>
  );
}

/**
 * A landed rehearsal, folded to one line.
 *
 * Tucked under the turn rather than ballooning into a full-width band - Kit's note records the
 * complaint that produced this shape, "related things taking up one whole megablock". Clicking
 * reopens it; clicking again folds it back.
 */
export function RehearsalTrace({
  text,
  seconds,
  open,
  onToggle,
}: {
  text: string;
  seconds: number;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div className="kit-trace">
      <button type="button" className="kit-trace__line" onClick={onToggle}>
        {`· ${open ? "hide the rehearsal" : traceSummary(seconds, [...text].length)}`}
      </button>
      {open && <p className="kit-trace__full">{text}</p>}
    </div>
  );
}

/**
 * The watcher: something changed in the studio that Kit did not do.
 *
 * A FRAMED ASIDE, NOT A LINE OF PROSE, and the reason is a category one rather than a styling one.
 * Everything else in a transcript is somebody talking - you, the agent, a tool reporting back. This
 * is the only line that is nobody talking: the building said a change happened. A line that reads
 * like speech but came from no one is the hardest kind to parse, so it gets a gold spine, a seam
 * border and a dim uppercase header instead of sharing the transcript's voice.
 */
export function WatchNote({ kinds }: { kinds: readonly string[] }): JSX.Element {
  const what = kinds.length > 0 ? kinds.join(", ") : "the studio folder";
  return (
    <div className="kit-watch">
      <div className="kit-watch__head">{"NOTICED"}</div>
      <p className="kit-watch__text">{`${what} changed on disk, outside this window.`}</p>
    </div>
  );
}

/**
 * The searchlight: a rose beam gliding along the composer's top edge while a turn runs.
 *
 * Flush against the input so the two read as one unit, exactly as Kit draws it. A terminal animates
 * this per cell on a timer; a browser can do the same gradient far more cheaply in CSS, so the
 * shape is Kit's and the mechanism is the one this medium is good at. The full pass takes the same
 * 11.4 seconds Kit's does (190 ticks at 60ms), because a faster sweep reads as urgency and this one
 * is deliberately calm.
 */
export function Searchlight({ on }: { on: boolean }): JSX.Element | null {
  if (!on) return null;
  /**
   * A ROW OF HEAVY LINE CHARACTERS, not a hairline. Kit draws a full text row of U+2501 and colours
   * each cell from a 16 step rose ramp, so the beam is a glow travelling along a solid rule. Drawn
   * as a 1px border it was invisible, which is not a subtler version of the same thing - the whole
   * widget is "the line is lit where the light is".
   *
   * The gradient is clipped to the glyphs so the ramp lands on the rule itself, and the dim tail is
   * the ramp head rather than transparency, which is what keeps the unlit rule visible.
   */
  return (
    <div className="kit-sweep" aria-hidden="true">
      <span className="kit-sweep__rule">{"━".repeat(240)}</span>
    </div>
  );
}

/** A row of keyboard hints: a bright key, then a muted label. Kit's CLI signature. */
export function KeyHints({ hints }: { hints: readonly { key: string; label?: string }[] }): JSX.Element {
  return (
    <div className="kit-hints">
      {hints.map((hint) => (
        <span key={hint.key} className="kit-hints__pair">
          <span className="kit-hints__key">{hint.key}</span>
          {hint.label !== undefined && <span className="kit-hints__label">{hint.label}</span>}
        </span>
      ))}
    </div>
  );
}
