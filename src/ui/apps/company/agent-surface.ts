/**
 * What The Company tells the agent window about itself.
 *
 * A DOOR, NOT A ROOM. This app is `comingSoon: true`, which means the shell refuses to mount it
 * (store.mountApp returns early) and its Component never renders anything. So the live half here is
 * wired but does not run yet, and this file says so rather than leaving a reader to work it out from
 * a manifest flag three files away.
 *
 * The static half still earns its place: an agent asked "what is The Company" would otherwise be
 * handed readSurface's fallback ("This screen has not described itself"), which is true and useless.
 * "It is docked, it installs later, there is nothing behind it" is the honest answer, and it is the
 * one thing anybody actually asks about a dimmed tile.
 *
 * NO ACTIONS. Nothing here can be reached for, and a menu of things that do not exist is how an
 * agent ends up offering to do them.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec } from "../../agent/surface";
import type { AppContext } from "../../app-contract";

/** The static half, which the manifest carries. */
export const COMPANY_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "The house agent's future door. It is docked as an honest \"installs later\" tile and cannot be " +
    "opened yet; nothing is edited, converted or stored behind it.",
};

/**
 * There is no input, because there is nothing on screen to vary with.
 *
 * A builder that took a shape it did not use would look like the others and prove nothing. This one
 * has exactly one true sentence to say, and it stays a function so the day the room lands it grows
 * arguments instead of a caller.
 */
export function companyAgentState(): AgentState {
  return {
    headline: "The Company, which has no room behind it yet.",
    notes: [
      "This tile is dimmed in the dock on purpose: the act it belongs to has not shipped.",
      "Nothing can be opened, edited or exported from here. The Library and the Workbench are where " +
        "pieces live in the meantime.",
    ],
  };
}

/**
 * Publish the door, and LEAVE IT PUBLISHED.
 *
 * Wired now so the seam is real the day the room opens, and dormant until then: the shell will not
 * mount a `comingSoon` app, so this effect does not run in the shipped build. It publishes once,
 * with no cleanup, for the same reason every other room does - the agent window unmounts the screen
 * it exists to describe. See live-state.ts.
 */
export function usePublishCompanySurface(ctx: AppContext): void {
  /** `ctx` is held rather than depended on: the shell rebuilds it on every store write. */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(companyAgentState());
  }, []);
}
