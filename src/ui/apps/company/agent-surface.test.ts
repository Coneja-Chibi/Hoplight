/**
 * What The Company tells the agent about a door that does not open yet.
 *
 * Small on purpose, and worth having anyway: the failure mode for an unshipped app is an agent that
 * talks about it in the present tense, and somebody looking for a feature that is not there.
 */
import { describe, expect, test } from "bun:test";
import { COMPANY_AGENT_SURFACE, companyAgentState } from "./agent-surface";

describe("companyAgentState", () => {
  test("it says the room is absent, in the same tense the dimmed tile promises", () => {
    // "The Company" alone reads like a room with contents. The dock already tells a person it
    // installs later; the brief is the only place that can tell a model the same thing.
    const state = companyAgentState();

    expect(state.headline).toContain("no room behind it yet");
    expect(state.notes?.join(" ")).toContain("has not shipped");
  });

  test("it points somewhere real instead of leaving a dead end", () => {
    // Somebody who opened this tile wanted to do something. Naming the rooms that exist is the only
    // useful sentence available on a screen with nothing on it.
    expect(companyAgentState().notes?.join(" ")).toContain("Library and the Workbench");
  });

  test("NO ACTIONS ARE DECLARED, because none can be reached for", () => {
    /**
     * briefText prints declared actions under "Worth reaching for here", which is an invitation. On
     * an app the shell refuses to mount, every one of them would be an offer to do something that
     * cannot happen - the exact failure the empty list prevents.
     */
    expect(COMPANY_AGENT_SURFACE.actions).toBeUndefined();
    expect(COMPANY_AGENT_SURFACE.describe).toContain("installs later");
  });
});
