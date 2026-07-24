/**
 * Source-checkout switch engine: move a `git`-run Hoplight to a release tag by checking it out and
 * reinstalling. Refuses a dirty TRACKED tree and names the files (never stashes a user's work); captures
 * the exact prior ref BEFORE any mutation and, on any failure, restores that ref + reinstalls so a failed
 * switch always lands back where it started, never a broken half-checkout. Orchestration only, tested with
 * a fake GitRunner; the real git edge is git-runner.ts.
 */
import type { GitRunner } from "./git-runner";
import { realSpawnSelf } from "../server-lifecycle";
import type { SwitchAction } from "./manager";

export interface SourceSwitchDeps {
  git: GitRunner;
  onProgress?: (message: string) => void;
  /** relaunch the (now checked-out) app; defaults to the shared lifecycle respawn. Injected for tests. */
  relaunch?: () => void;
}

/**
 * Prepare a source switch to `tag`. Resolves with a "restart" action once the tree is on the new tag;
 * throws a user-facing message on refusal/failure (a dirty tree names the files). The caller (switch
 * manager) writes the pending-switch marker, then runs the restart and exits.
 */
export async function sourceSwitch(tag: string, deps: SourceSwitchDeps): Promise<SwitchAction> {
  const { git, onProgress } = deps;

  const dirty = await git.dirtyTrackedFiles();
  if (dirty.length > 0) {
    const shown = dirty.slice(0, 5).join(", ");
    const more = dirty.length > 5 ? ` and ${dirty.length - 5} more` : "";
    throw new Error(`switch refused: you have uncommitted changes in ${shown}${more}. Commit or discard them first.`);
  }

  // Capture the exact restore target BEFORE touching anything (a branch name, or a detached-HEAD sha).
  const priorRef = await git.currentRef();

  onProgress?.("Finding the release...");
  await git.fetchTags();
  if (!(await git.tagExists(tag))) throw new Error(`switch: no release is tagged ${tag}`);

  onProgress?.(`Switching to ${tag}...`);
  try {
    await git.checkout(tag);
    onProgress?.("Reinstalling dependencies...");
    await git.install();
  } catch (e) {
    onProgress?.("Switch failed, restoring your previous version...");
    try {
      await git.checkout(priorRef);
      await git.install();
    } catch {
      // restore itself failed; the ORIGINAL error is the actionable one, so surface that
    }
    throw e;
  }

  return { kind: "restart", run: deps.relaunch ?? realSpawnSelf };
}
