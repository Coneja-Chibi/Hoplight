/**
 * Picking up where you left off, once, at launch.
 *
 * Kit has always opened blank and made resuming a thing you go and find, which is right as a default
 * - opening into somebody's last conversation unasked is how you reply to the wrong thread - but
 * wrong as the only option, because most mornings the session you want is the one you were in.
 *
 * ONCE PER PROCESS. The guard is a ref rather than a dependency list: `open` swaps the whole
 * transcript, which re-renders, and a resume that re-fired on its own output would fight anybody who
 * started a fresh session afterwards.
 */
import { useEffect, useRef } from "react";
import type { SessionActions } from "../sessions/session-actions";

/** What was asked for: the latest session, or one named outright. */
export type ResumeRequest = true | string;

export function useResumeAtLaunch(
  request: ResumeRequest | undefined,
  actions: SessionActions,
  say: (text: string) => void,
): void {
  const done = useRef(false);
  useEffect(() => {
    if (request === undefined || done.current) return;
    done.current = true;
    void (async () => {
      try {
        if (typeof request === "string") {
          await actions.open(request);
          return;
        }
        // Newest first, per the store's list contract.
        const [latest] = await actions.list();
        if (!latest) {
          // SAID, not silent. A blank screen after `kit -r` is indistinguishable from a broken flag.
          say("No saved sessions yet, so this is a fresh one.");
          return;
        }
        await actions.open(latest.id);
      } catch {
        // `open` already says why a session would not load; this is the belt for anything else, and
        // a launch flag must never be able to stop Kit from opening at all.
        say("Could not resume the last session, so this is a fresh one.");
      }
    })();
  }, [request, actions, say]);
}
