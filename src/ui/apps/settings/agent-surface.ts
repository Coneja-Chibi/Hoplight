/**
 * What Settings tells the agent window about itself.
 *
 * THE ONE SCREEN THAT MUST NOT DESCRIBE ITSELF FULLY. Settings is where the Remote access tab shows
 * a connect code, a Tailscale URL and a certificate fingerprint, and where a provider key would be
 * pasted if it were pasted anywhere in the UI. The brief this builds lands in the SYSTEM position of
 * a model request that leaves the machine, so "describe what is on screen" is exactly the wrong
 * instruction to follow here.
 *
 * SO THE LEAK IS MADE IMPOSSIBLE RATHER THAN FORBIDDEN. `readSettingsSurface` reads a fixed list of
 * SETTING_KEYS and nothing else, and `settingsAgentState` takes only that narrow shape. A code, a
 * URL, a fingerprint or a key is not an argument to any function in this file, so no future edit to
 * the room can hand one over by accident. A test asserting "it did not leak" would only prove it
 * about the values the test thought to try.
 *
 * The keys themselves are not here to be described either: they live in the vault on the server (see
 * kit/providers/vault), and this screen has no model or provider control at all.
 */
import { useEffect, useRef } from "react";
import type { AgentState, AgentSurfaceSpec } from "../../agent/surface";
import type { AppContext } from "../../app-contract";
import { SETTING_KEYS } from "../../../studio/settings-shape";

/** The static half, which the manifest carries. */
export const SETTINGS_AGENT_SURFACE: AgentSurfaceSpec = {
  describe:
    "Where the studio is configured, one tab per area: appearance, the studio folder, workbench " +
    "behaviour, remote access, updates, and about. Secrets shown on these tabs are never described " +
    "to an agent.",
  actions: [
    {
      id: "explain-setting",
      label: "Explain a setting",
      describe: "Say in plain words what one of these settings changes, before it gets changed.",
    },
    {
      id: "find-setting",
      label: "Find the right tab",
      describe: "Say which tab holds the thing somebody is looking for, without guessing at its value.",
    },
  ],
};

/** One tab, as this surface names it. */
export interface SettingsTab {
  readonly id: string;
  readonly label: string;
}

/**
 * The ONLY shape that reaches the brief. Every field is a plain scalar the user chose from a control
 * with a fixed set of options - never a value somebody pasted in.
 */
export interface SettingsSurfaceInput {
  readonly tabs: readonly SettingsTab[];
  /** Tab id the room is showing. */
  readonly activeId: string;
  /** "paper", "stage", or "" when the studio has never been given one. */
  readonly theme: string;
  /** WHETHER an accent was chosen, not which one - the value is a colour and this file names none. */
  readonly houseAccentSet: boolean;
  /** App id that opens on boot, "" when the studio has not been told. */
  readonly homeApp: string;
  /** Deck kind the Library opens on, "" when unset. */
  readonly firstDeck: string;
  /** Friendly platform names picked at setup. */
  readonly publishTargets: readonly string[];
  readonly remoteAccessOn: boolean;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Read the narrow shape out of settings.
 *
 * THE FIXED KEY LIST IS THE GUARD. A generic "give me every setting" reader would carry whatever a
 * drop-in setup step wrote into the open record - which is where a token would end up if one ever
 * arrived - so this names its six keys and cannot be asked for a seventh.
 */
export function readSettingsSurface(
  get: (key: string) => unknown,
  tabs: readonly SettingsTab[],
  activeId: string,
): SettingsSurfaceInput {
  const targets = get(SETTING_KEYS.publishTargets);
  return {
    tabs,
    activeId,
    theme: str(get(SETTING_KEYS.theme)),
    houseAccentSet: str(get(SETTING_KEYS.houseAccent)) !== "",
    homeApp: str(get(SETTING_KEYS.homeApp)),
    firstDeck: str(get(SETTING_KEYS.firstDeck)),
    publishTargets: Array.isArray(targets) ? targets.filter((t): t is string => typeof t === "string") : [],
    remoteAccessOn: get(SETTING_KEYS.remoteAccessEnabled) === true,
  };
}

export function settingsAgentState(input: SettingsSurfaceInput): AgentState {
  const active = input.tabs.find((t) => t.id === input.activeId);
  const notes: string[] = [];

  notes.push(
    input.theme === ""
      ? "The theme has never been set, so the studio is on its default."
      : `The theme is ${input.theme}.`,
  );
  notes.push(
    input.houseAccentSet
      ? "A house accent has been chosen. Its value is a colour and is not reported here."
      : "No house accent has been chosen.",
  );
  if (input.homeApp !== "") notes.push(`The studio opens on ${input.homeApp}.`);
  if (input.firstDeck !== "") notes.push(`The Library opens on the ${input.firstDeck} deck.`);
  notes.push(
    input.publishTargets.length > 0
      ? `Publish targets picked at setup: ${input.publishTargets.join(", ")}.`
      : "No publish targets were picked at setup, so every format stays available.",
  );

  /**
   * ON, not HOW. Whether the studio is reachable from another device is a fact worth an agent
   * knowing; the connect code, the mesh URL and the certificate fingerprint that make it reachable
   * are on the same tab and are none of its business.
   */
  notes.push(
    input.remoteAccessOn
      ? "Remote access is on. The connect code, address and fingerprint that go with it are on this " +
          "screen and are deliberately not described."
      : "Remote access is off.",
  );

  /**
   * Said out loud so a model does not go looking. There is no provider or model control in this
   * room, and the key that would answer "which model am I on" is held server-side in the vault; the
   * agent window asks the server for that, and this screen never sees it.
   */
  notes.push(
    "No provider key, token or vault content appears on this screen or in this description. " +
      "Whether a model is connected is not configured here.",
  );

  return {
    headline: active
      ? `Settings, on the ${active.label} tab.`
      : "Settings, with no tab selected.",
    /** The tabs, so "where do I change that" has an answer without a guess at any value. */
    items: input.tabs.map((t) => ({
      kind: "settings-tab",
      id: t.id,
      name: t.label,
      ...(t.id === input.activeId ? { focused: true } : {}),
    })),
    notes,
  };
}

/**
 * Publish the tabs, and LEAVE IT PUBLISHED.
 *
 * No cleanup on unmount: the shell swaps apps through one slot, so opening the agent window unmounts
 * the room the window exists to describe. See live-state.ts.
 */
export function usePublishSettingsSurface(
  ctx: AppContext,
  input: { readonly tabs: readonly SettingsTab[]; readonly activeId: string },
): void {
  const { tabs, activeId, theme, houseAccentSet, homeApp, firstDeck, publishTargets, remoteAccessOn } =
    readSettingsSurface((key) => ctx.prefs.get(key), input.tabs, input.activeId);
  /** Which tabs exist, not the array the registry rebuilt this render. */
  const tabsKey = tabs.map((t) => t.id).join(",");
  const targetsKey = publishTargets.join(",");

  /**
   * `ctx` is held rather than depended on. The shell rebuilds it on EVERY store write - and every
   * control in this room writes settings - so depending on it would republish on each keystroke and,
   * during an app switch, stamp the outgoing screen with the incoming app's name.
   */
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    ctxRef.current.agent.publish(
      settingsAgentState({
        tabs, activeId, theme, houseAccentSet, homeApp, firstDeck, publishTargets, remoteAccessOn,
      }),
    );
    // tabsKey and targetsKey stand in for tabs and publishTargets, which are new arrays on every
    // render of the room; comparing those by identity republished on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey, targetsKey, activeId, theme, houseAccentSet, homeApp, firstDeck, remoteAccessOn]);
}
