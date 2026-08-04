/**
 * Enter, from the rail: stage, confirm, apply, report.
 *
 * THE GATE SITS IN THE MIDDLE, and that is the whole reason this is four steps instead of one write.
 * Staging composes an ordinary draft and writes nothing. The confirm is the SAME pause a model draft
 * gets, reached by calling the gate controller directly rather than through a turn, so a person
 * rearranging blocks by hand meets exactly the surface they already know. Only then does the apply
 * run, revision-checked, once.
 *
 * A rail that wrote on enter would be a second write path with no confirmation; a rail that confirmed
 * every drag would be unusable. One draft for a session of rearranging is how both stay true.
 *
 * EVERY FAILURE IS SAID OUT LOUD. A refusal to stage, a denial at the gate, and a stale revision are
 * three different things and lead to three different next moves, so none of them is reported as a
 * generic "could not save".
 */
import type { OutlineRow } from "../../../core/preset/outline";
import type { RailStaged } from "../../session";
import type { ChangeReceipt } from "../../changes/types";
import type { GateChoice } from "../../tools/safety/permission-mode";
import type { GateRequest } from "../../tools/safety/gated-dispatch";

export interface CommitDeps {
  stage: (id: string, rows: readonly OutlineRow[]) => Promise<RailStaged>;
  commit: (draftId: string) => Promise<ChangeReceipt>;
  /**
   * Drop a staged draft that will not be applied.
   *
   * REQUIRED, NOT OPTIONAL, because a change session holds at most one active draft per piece. A
   * staged draft left behind after a refusal makes the NEXT attempt throw "an active draft already
   * exists", so declining once would break every later attempt until the session restarted. Found by
   * running it: deny, edit, enter, crash.
   */
  discard: (draftId: string) => void;
  confirm: (request: GateRequest) => Promise<GateChoice>;
  say: (text: string) => void;
}

/** The verdict a caller acts on: applied means the baseline should be re-read. */
export type CommitOutcome =
  | { applied: true; receipt: ChangeReceipt }
  | { applied: false; reason: "refused" | "denied" | "failed" };

export async function commitRail(
  presetId: string,
  rows: readonly OutlineRow[],
  deps: CommitDeps,
): Promise<CommitOutcome> {
  const staged = await deps.stage(presetId, rows);
  if (!staged.ok) {
    deps.say(staged.detail);
    return { applied: false, reason: "refused" };
  }

  const request: GateRequest = {
    name: "rail_apply",
    peek: {
      title: "rearrange blocks",
      detail: `${presetId}`,
      level: "caution",
      reason: "You changed the block list. This writes it to the studio.",
    },
    // Caution rather than danger: it edits one piece that already exists and cannot reach anything
    // else. The review rows below carry the detail, so the panel shows the change, not the tool.
    verdict: { level: "caution", access: "write", reason: "writes one stored preset" },
    review: staged.review,
  };

  const choice = await deps.confirm(request);
  if (choice.type !== "allow-once" && choice.type !== "allow-session") {
    // The DRAFT goes; the rail's edits stay. Those are different things, and conflating them is what
    // made the first version wrong in both directions at once: it kept a draft nobody would apply,
    // and its message implied the work was safe because of that draft rather than because the rail
    // still holds it. Throwing away a session of rearranging over one keystroke would be the wrong
    // reading of "no"; so would leaving a stale draft that breaks the next attempt.
    deps.discard(staged.draftId);
    deps.say("Not applied. Your changes are still in the rail.");
    return { applied: false, reason: "denied" };
  }

  const receipt = await deps.commit(staged.draftId);
  if (receipt.status !== "applied") {
    // Apply already retires the draft on a stale or failed outcome, but discarding is idempotent and
    // the alternative is a rail that can only ever be applied once per session if that changes.
    deps.discard(staged.draftId);
    deps.say(
      receipt.status === "stale"
        ? "The preset changed underneath this edit, so nothing was written. Reopen the rail."
        : `Not written: ${receipt.detail}`,
    );
    return { applied: false, reason: "failed" };
  }
  deps.say(`Applied to ${presetId}.`);
  return { applied: true, receipt };
}
