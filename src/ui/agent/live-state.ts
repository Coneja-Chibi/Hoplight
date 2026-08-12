/**
 * Who holds the snapshot of the screen the user was last on.
 *
 * THE LAST SCREEN THAT DESCRIBED ITSELF WINS, AND IT IS NEVER WITHDRAWN. That is the whole contract,
 * and the first version got it exactly backwards: publishing returned a cleanup that cleared the
 * snapshot on unmount, in the honest-looking belief that a screen which had gone away should stop
 * being described.
 *
 * It is wrong because of how the shell mounts apps. Opening the agent window UNMOUNTS the app behind
 * it - they share one slot - so the Library's cleanup ran, cleared the snapshot, and the window read
 * null every single time. The window said "no screen has described itself yet" and every turn went
 * to the model with no context at all, which is the entire feature. The one navigation the design
 * exists to serve was the one that broke it.
 *
 * So a snapshot persists until another screen publishes over it. That is not staleness to be
 * tolerated, it is the point: the agent window's whole job is describing the screen you CAME FROM,
 * which by definition is no longer mounted. The `appId` rides along so a reader can tell which.
 *
 * The token that used to guard against a late withdrawal is gone with the withdrawal itself. There
 * is nothing left to race: publishing is the only operation.
 */
import type { AgentState } from "./surface";

/**
 * A published snapshot and who published it.
 *
 * THE APP ID IS STAMPED BY THE SHELL, not passed by the app. Apps never learn which app is active -
 * that is shell state and the one-door rule keeps it there - but the shell builds `ctx.agent` and
 * knows exactly who it is building it for. It also makes the id trustworthy: an app cannot claim to
 * be a screen it is not.
 */
export interface PublishedSurface {
  readonly appId: string;
  readonly state: AgentState;
}

/** The reader. It never publishes; see the note on `liveSurface` below for why that matters. */
export const AGENT_APP_ID = "agent";

export interface LiveSurface {
  /** The last screen that described itself, or null before any has. */
  current(): PublishedSurface | null;
  /** Describe this screen. Replaces whatever was there; there is no un-publishing. */
  publish(appId: string, state: AgentState): void;
  /** Subscribe to changes; returns the unsubscribe. */
  onChange(cb: () => void): () => void;
}

export function createLiveSurface(): LiveSurface {
  let state: PublishedSurface | null = null;
  const listeners = new Set<() => void>();

  return {
    current: () => state,
    publish(appId: string, next: AgentState): void {
      state = { appId, state: next };
      // Copied before iterating: a listener that unsubscribes itself would otherwise mutate the set
      // mid-loop and skip whoever came after it.
      for (const cb of [...listeners]) cb();
    },
    onChange(cb: () => void): () => void {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}

/**
 * The one every app publishes to and the agent window reads.
 *
 * A module singleton because there is exactly one shell on a page and exactly one screen in front of
 * the user. The factory stays exported so tests get their own and never share state.
 *
 * ONE INSTANCE MEANS THE SHELL'S INSTANCE. Every app under /apps is bundled separately, so an app
 * that imports this module gets its own copy of it - a different object from the one the shell
 * publishes into, permanently empty. The agent room did exactly that and could not see a single
 * publish: mounted as a dock app it said "no screen has described itself yet" from every screen,
 * while the identical component in the floating panel worked, because the panel renders inside the
 * shell's bundle. Apps reach this only through `ctx.agent` (publish / current / onChange), which the
 * shell builds over THIS instance. Same shape as the `instanceof` split in _shared/api-fetch.ts, and
 * just as invisible to a typecheck.
 *
 * A MOUNTED SCREEN IS A SCREEN YOU ARE STANDING ON, whether or not it has anything live to say. Only
 * five apps ever call publish; six never do - Docs, the Macro Lab, HTML View, the CSS Workshop, the
 * Apps catalog and the agent itself - and from any of those the window had no reading at all, so the
 * turn went to the model carrying no screen context, which is the whole feature. The static half was
 * always there (every manifest declares `agentSurface.describe`, and readSurface works with
 * `state: null`); it simply had no carrier. The shell therefore publishes a bare `<title> is open.`
 * snapshot as an app mounts, and an app with something better replaces it a beat later from its own
 * render. NOT for the agent itself: that would publish "agent" over the screen you came from and the
 * window would describe itself, which is the confusion the shell-stamped appId exists to prevent.
 */
export const liveSurface: LiveSurface = createLiveSurface();
