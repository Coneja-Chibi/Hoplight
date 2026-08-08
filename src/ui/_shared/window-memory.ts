/**
 * What this browser window remembers between reloads, and how to make it forget.
 *
 * WHY THIS IS A BUTTON AND NOT WHAT REFRESH DOES. Nothing here is an HTTP cache - the page, the
 * shell bundle, every app module and the vendor bundles are all served `no-store`, so a plain
 * refresh already runs current code and a hard refresh buys nothing. What survives a refresh is
 * REMEMBERED STATE, and every piece of it was added on purpose: the app you were on (so a reload
 * stops dumping you on the Workbench), the agent conversation (so a dev live-reload does not eat
 * it), where you dragged the overlay. Clearing those on every refresh would undo three fixes to
 * solve a problem nobody has. Clearing them when somebody ASKS is a different thing entirely.
 *
 * A LEAF ON PURPOSE. The keys live here rather than in the modules that read them, and those
 * modules import from here, because this file is reached from the Settings app - which may not
 * import shell modules, and should not pull a React hook into its bundle to learn a string. One
 * spelling of each key, and nothing heavy behind it.
 *
 * WHAT IT NEVER TOUCHES, which is the point of the list being short and named:
 *   - the studio: not one file is read or written here;
 *   - settings.json, including the open Workbench tabs, which are meant to survive a kill;
 *   - the theme, whose cached copy only prevents a white flash before settings load.
 */

/** The app you were on when the page last reloaded. Written by the shell store's mountApp. */
export const ACTIVE_APP_KEY = "vaude.session.activeApp";
/** The agent window's conversation, kept so a reload does not lose what was said. */
export const TRANSCRIPT_KEY = "hoplight.agent.transcript";
/** Where the floating agent overlay was dragged and how big it was left. */
export const PANEL_KEY = "hoplight.agent.panel";
/**
 * Which saved session this tab's conversation is being written to.
 *
 * CLEARED WITH THE TRANSCRIPT, never on its own. The two are one thing: a fresh conversation on
 * screen writing into the session behind the old one would braid two conversations into one file.
 * The file itself is untouched and stays resumable - reset means start fresh here, not delete.
 */
export const AGENT_SESSION_KEY = "hoplight.agent.session";

/** The session id this tab is writing to, or "" when the next turn should open a new one. */
export function readAgentSessionId(): string {
  try {
    return sessionStorage.getItem(AGENT_SESSION_KEY) ?? "";
  } catch {
    // Storage unavailable: every turn opens a new session, which loses continuity but never data.
    return "";
  }
}

/** Everything a reset forgets, with the storage each one lives in. */
export const RESET_KEYS: readonly { readonly key: string; readonly where: "session" | "local" }[] = [
  { key: ACTIVE_APP_KEY, where: "session" },
  { key: TRANSCRIPT_KEY, where: "session" },
  { key: AGENT_SESSION_KEY, where: "session" },
  { key: PANEL_KEY, where: "local" },
];

/**
 * Clear them.
 *
 * TOTAL: storage can be unavailable (privacy mode, an embedded view), and a reset that throws
 * halfway would leave the window in a stranger state than the one somebody pressed the button to
 * escape. Each key is removed on its own, so one failure costs exactly one key.
 */
export function clearWindowMemory(): void {
  for (const entry of RESET_KEYS) {
    try {
      const store = entry.where === "session" ? sessionStorage : localStorage;
      store.removeItem(entry.key);
    } catch {
      /* storage unavailable: nothing to clear, and nothing worth reporting */
    }
  }
}
