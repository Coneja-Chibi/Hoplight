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
 */
export const liveSurface: LiveSurface = createLiveSurface();
