/**
 * Kit's transcript bands: the copyable one, the folded one, the failed one, and the toast.
 *
 * A BAND IS A SHADED SEGMENT WITH A SPINE, and nothing draws a rule between messages. That is Kit's
 * grammar and it is already in this window's stylesheet; what was missing is everything a band can
 * DO. In Kit every message can be copied, a long reply folds, and a failure is a red-spined band
 * rather than a stray paragraph. This file is that half.
 *
 * THE COPY CORNER IS HOVER-ONLY AND LAYERED, never in the flow. Kit draws it absolutely positioned
 * in the band's top right for one reason: a control that took a row would move every message down
 * by a line the moment a mouse crossed it, and a transcript that reflows under the pointer is one
 * you cannot read.
 */
import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { boundedError, foldSummary } from "./kit-bands-core";

/**
 * The small hover affordance in a band's corner.
 *
 * The key is drawn beside the word the way every hint in Kit is drawn - a bright key, a quiet
 * label - so the mouse teaches the keyboard.
 */
function CopyCorner({ onCopy }: { onCopy: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="kit-band__copy"
      // The band underneath may be foldable; copying must not also collapse what was copied.
      onClick={(event) => { event.stopPropagation(); onCopy(); }}
    >
      {"copy"}
    </button>
  );
}

/**
 * A band with a copy corner.
 *
 * COPYING IS WHAT A TRANSCRIPT IS FOR. An answer containing a path, a command or a patch exists to
 * be used somewhere else, and selecting wrapped text with a mouse across a scrolling pane is the
 * worst way anybody has ever moved a string. Kit put a corner on every band; so does this.
 *
 * The clipboard write can be refused - a page without focus, a browser that wants a gesture it did
 * not see - so the outcome is reported rather than assumed. A "copied" that did not copy is worse
 * than no button, because somebody pastes and gets whatever was there before.
 */
export function CopyableBand({
  className,
  text,
  onNotice,
  onClick,
  children,
}: {
  className: string;
  /** What the corner copies. Absent means no corner: nothing to copy is not a disabled button. */
  text?: string;
  onNotice?: (message: string) => void;
  onClick?: () => void;
  children: ReactNode;
}): JSX.Element {
  const copy = useCallback(() => {
    if (text === undefined) return;
    /**
     * THE ABSENCE OF A CLIPBOARD IS A REFUSAL, NOT A CRASH. `navigator.clipboard` is undefined in
     * an insecure context and in some embedded webviews, and chaining `.then` onto that undefined
     * would throw inside a click handler - a copy button that takes the window down instead of
     * saying it could not copy.
     */
    const written = navigator.clipboard?.writeText(text);
    if (!written) { onNotice?.("could not reach the clipboard"); return; }
    void written
      .then(() => { onNotice?.("copied"); })
      .catch(() => { onNotice?.("could not reach the clipboard"); });
  }, [text, onNotice]);

  return (
    <div className={`${className} kit-band`} {...(onClick ? { onClick } : {})}>
      {children}
      {text !== undefined && <CopyCorner onCopy={copy} />}
    </div>
  );
}

/**
 * A long reply, folded to one line.
 *
 * Kit's shape: a teal-deep dot, what it was, how much there is, and how to get it back. Tucked
 * under the turn as one indented row rather than a full-width band, for the same reason the
 * rehearsal trace is - "related things taking up one whole megablock" was the complaint that
 * produced both.
 */
export function FoldedSay({ text, onToggle }: { text: string; onToggle: () => void }): JSX.Element {
  return (
    <button type="button" className="kit-fold" onClick={onToggle}>
      <span className="kit-fold__dot">{"· "}</span>
      {foldSummary(text)}
    </button>
  );
}

/**
 * A failure, as a band rather than as a loose paragraph.
 *
 * A RED SPINE AND A BANG, because a failure that looks like prose reads as something the agent
 * said. This window was printing provider errors into a bare paragraph, which put "the server
 * refused the turn" in the same visual register as an answer.
 *
 * The text is capped at Kit's ERROR_ROW_CHARS: a provider failure is not bounded, and a proxy that
 * returns an HTML error page would otherwise take the whole transcript with it.
 */
export function ErrorRow({
  text,
  onNotice,
}: {
  text: string;
  onNotice?: (message: string) => void;
}): JSX.Element {
  return (
    <CopyableBand className="kit-error" text={text} {...(onNotice ? { onNotice } : {})}>
      <p className="kit-error__text">
        <span className="kit-error__bang">{"! "}</span>
        {boundedError(text)}
      </p>
    </CopyableBand>
  );
}

/**
 * A brief statement about something the window itself just did.
 *
 * NOT A MESSAGE AND NOT AN ERROR. "copied" is the outcome of a local gesture, not something anybody
 * said, so Kit gives it its own hushed row above the composer rather than a band in the transcript.
 * Putting it in the conversation would make the log a record of clicks.
 */
export function StatusToast({ text }: { text: string | null }): JSX.Element | null {
  if (!text) return null;
  return (
    <div className="kit-toast" role="status">
      <span className="kit-toast__dot">{"· "}</span>
      {text}
    </div>
  );
}

/**
 * The toast's timer, owned here so no caller has to remember to clear it.
 *
 * It fades on its own because a notice that stays is a notice you stop reading, and the next one
 * REPLACES the last rather than queueing: two copies in a row should say "copied" once, not twice.
 */
export function useNotice(holdMs = 2_200): {
  notice: string | null;
  say: (message: string) => void;
} {
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * A REF, not state. The timer is not something the view draws, and holding it in state would
   * both re-render for nothing and - under a double-invoked updater - leave an orphaned timeout
   * that clears a notice somebody has not read yet.
   */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((message: string): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setNotice(null); }, holdMs);
    setNotice(message);
  }, [holdMs]);

  // An unmount mid-notice must not leave a timer holding a setState on a component that is gone.
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  return { notice, say };
}
