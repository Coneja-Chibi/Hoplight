/**
 * The follow decision, pure and testable. Sending pieces to the Workbench has to answer one
 * question: what happens to the view afterwards? That depends only on where the sender already is
 * and the saved follow preference, never on the DOM, so it lives here as data - isolated from the
 * shell that carries the answer out.
 *
 * This file exists to close a specific past miss. The decision used to sit inline in the send path
 * with an UNSTATED precondition: that the sender is somewhere other than the Workbench. Every caller
 * satisfied it (only the Library sent pieces), so nothing broke. When a sender was later added INSIDE
 * the Workbench (the recents rail), "follow to the Workbench?" became nonsense, but the implicit
 * precondition was nowhere named, so no test and no type flagged it. Naming `onWorkbench` as an input
 * and covering every branch turns that precondition explicit and permanent.
 */

/** What the shell should do with the view after opening fresh pieces. */
export type FollowAction = "surface" | "navigate" | "note" | "ask";

/**
 * Decide the post-send view action. When the sender is already on the Workbench there is nowhere to
 * follow to, so the newest piece is just surfaced (no dialog, no navigation). Otherwise the saved
 * preference rules: navigate now, stay put with a note, or ask once. Anything that is not exactly
 * "always" or "never" (unset, garbage, wrong type) falls to "ask" - the safe default, never a
 * silent jump - so this reads the stored value tolerantly as `unknown`.
 */
export function decideFollow(onWorkbench: boolean, pref: unknown): FollowAction {
  if (onWorkbench) return "surface";
  if (pref === "always") return "navigate";
  if (pref === "never") return "note";
  return "ask";
}
