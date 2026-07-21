/**
 * The tour contract - folders-as-schema for in-app tutorials, mirroring setup/step-contract.ts. A
 * TOUR is a folder src/ui/tours/<appId>/ whose index.tsx default-exports a Tour; the shell discovers
 * it with the SAME loader apps and setup steps use (server.ts discoverModules) and mounts one
 * <TourGuide> engine over it. Authoring a tutorial = dropping that folder in; nothing central is
 * edited, exactly like adding an app or a setup step.
 *
 * The data here is renderer-agnostic and effect-free - a pure description of what to say and what to
 * point at. Today's renderer is the docked rail (with a light highlight); a different feel later
 * renders the same steps without touching a single tour file. The pure sequencing logic lives in
 * tour-core.ts; the DOM/pref effects live in the TourGuide shell.
 */

/** An inline choice a step can offer (e.g. Bento vs Playbill). Picking writes `prefKey` through the
 * app context's prefs - the tour sets real preferences in-context, it does not just talk about them. */
export interface TourChoice {
  /** the pref key the pick writes (namespaced, e.g. "editor.layout") */
  prefKey: string;
  /** the pressable options; `value` is what lands in the pref */
  options: { value: string; label: string; sub?: string }[];
}

/** A navigation the engine runs the moment a step becomes active, so the tour DRIVES the user to the
 * right place instead of only describing it. Declarative: the tour data names intent, the engine
 * (which holds ctx) maps each to real calls. Every field is optional and additive.
 *   - open "piece": open a character on the Workbench so the editor populates (and later steps have
 *     real elements to highlight - a live layout/mode toggle beats a static mockup).
 *   - setPref: flip a preference first (e.g. force Grid so the bento chrome the next steps point at
 *     is actually on screen). Namespaced key, same store the app uses.
 */
export interface TourAct {
  open?: "piece";
  setPref?: { key: string; value: string };
}

/**
 * What an `open: "piece"` act actually DID, so a step can narrate honestly instead of claiming an
 * event that never happened (a fresh studio has nothing to open - the proven lie):
 *   - "focused": a piece was already on the bench; the tour brought it forward
 *   - "opened": the tour opened one of the user's library characters
 *   - "created": the studio was empty; the tour started a blank card
 */
export type TourOpenOutcome = "focused" | "opened" | "created";

/** One stop on the tour. */
export interface TourStep {
  /** a navigation to run when this step activates (drives the user; see TourAct) */
  act?: TourAct;
  /** stable id; also this step's progress key */
  id: string;
  /** the `data-tour` attribute value to point at ("layout-toggle"); omit for an intro/outro step
   * with no on-screen target. A named anchor that is not currently in the DOM is tolerated: the
   * step just shows without a highlight (never a crash). */
  anchor?: string;
  /** the big line (Archivo) */
  title: string;
  /** the plain-words body - no jargon a creator would not know */
  body: string;
  /** outcome-specific bodies for a step whose `act.open` ran: the engine renders the variant
   * matching what actually happened, falling back to `body`. Narration must never lie. */
  bodyBy?: Partial<Record<TourOpenOutcome, string>>;
  /** optional inline preference choice rendered inside the step (the "setup options" in-tour) */
  choice?: TourChoice;
}

export interface TourManifest {
  /** the app id this tour belongs to (its folder name); the shell loads tours/<appId> for the
   * active app, so this must match the app's own id */
  appId: string;
  /** the tour's friendly name, shown as the rail's kicker ("Getting started") */
  title: string;
}

/** The module a tour folder default-exports. */
export interface Tour {
  manifest: TourManifest;
  steps: TourStep[];
}
