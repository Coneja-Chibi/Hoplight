/**
 * The last net under the whole shell. Before this, ANY uncaught render error unmounted the React
 * root and the studio went blank - no stack, no reload, nothing to act on. The audit's LOGIC-001 was
 * exactly that: an empty deck threw inside a view and took the entire app down.
 *
 * Why there is a second button. The state that pinned that crash (the chosen view and deck) is
 * PERSISTED in settings.json, so "Reload" replays the same prefs into the same crash - the app is
 * bricked until someone hand-edits a file. Clearing those few view prefs is what actually breaks the
 * loop. It touches NO studio data: only `library.view`, `library.size`, `firstDeck`, which are
 * regenerated the moment you pick a deck again.
 */
import { Component, type ErrorInfo, type JSX, type ReactNode } from "react";
import { useShellStore } from "./store";
import { isBrowserStudio } from "../../browser-mode";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Prefs that can pin the shell to a crashing view (library/styles.ts). Deliberately a small
 * allow-list, not a wipe: settings.json also holds real user choices worth keeping.
 */
const VIEW_PREF_KEYS = ["library.view", "library.size", "firstDeck"];

export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // console is the whole report channel here; there is no telemetry and there should not be
    console.error("shell: uncaught render error", error, info.componentStack);
  }

  private reload = (): void => {
    if (isBrowserStudio() && !window.confirm(
      "Reloading will permanently discard every piece in this temporary Studio. Continue?",
    )) return;
    window.location.reload();
  };

  private resetViewPrefs = async (): Promise<void> => {
    try {
      const state = useShellStore.getState();
      const next = { ...state.settings };
      for (const key of VIEW_PREF_KEYS) delete next[key];
      await state.saveSettings(next);
    } catch {
      // if the save fails we still reload: a stale pref is better than a dead-end screen
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const browser = isBrowserStudio();
    return (
      <div className="shell-crash" role="alert">
        <h1 className="shell-crash-title">The studio hit an error</h1>
        {browser ? (
          <p className="shell-crash-body">
            This temporary Studio cannot export after a crash. Reloading will permanently discard
            every piece in this page. You will be asked to confirm before that happens.
          </p>
        ) : (
          <p className="shell-crash-body">
            Nothing on disk was touched. If this comes back every time you open the app, a saved view
            preference is the likely cause - the second button clears those and nothing else.
          </p>
        )}
        <pre className="shell-crash-msg">{error.message || String(error)}</pre>
        <div className="shell-crash-actions">
          <button type="button" className="shell-crash-btn" onClick={this.reload}>
            {browser ? "Discard page and reload" : "Reload"}
          </button>
          {!browser && (
            <button type="button" className="shell-crash-btn" onClick={() => void this.resetViewPrefs()}>
              Reset view settings and reload
            </button>
          )}
        </div>
      </div>
    );
  }
}
