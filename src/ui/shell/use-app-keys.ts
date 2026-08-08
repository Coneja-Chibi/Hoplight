/**
 * The one listener that turns a chord into a room change - the imperative half of app-keys.ts.
 *
 * NOTHING IS DECIDED HERE. Every question with an answer worth checking (is somebody typing, which
 * tile is the third one, does this chord mean anything) lives in the pure table next door, where a
 * test can ask it. This file owns exactly the three things a pure function cannot: reading the live
 * DOM event, reading the live store, and calling `mountApp`.
 *
 * MOUNTED ONCE, FROM App.tsx. A listener per surface is how a shortcut ends up firing twice, or
 * surviving the screen that installed it.
 */
import { useEffect } from "react";
import { appRoster, appShortcut, stepApp } from "./app-keys";
import { useShellStore } from "./store";

export function useAppKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const state = useShellStore.getState();
      // A dialog that is up OWNS the keyboard. The follow prompt, the close-piece prompt and the
      // context menu are each asking a question with an Escape and an Enter in it; walking the user
      // to another room mid-question leaves an unanswered dialog over a screen it was not about.
      if (state.followPrompt || state.pendingClose || state.openMenu) return;

      const roster = appRoster(state.manifests);
      const hit = appShortcut(
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          // The LorebookEditor precedent: narrow the target once, here, and let the pure guard read
          // it. A non-element target (there is no such keydown, but the type allows one) is not a
          // text surface, so null is the honest answer rather than a refusal.
          target: event.target instanceof HTMLElement ? event.target : null,
        },
        roster,
      );
      if (!hit) return;

      // PREVENTED BECAUSE A BINDING MATCHED, not because the app changed. `mountApp` no-ops on the
      // room already on screen, and the user still pressed a real chord - letting the default
      // through on the second press of ctrl+1 would be the browser doing something arbitrary with a
      // key this shell claims.
      event.preventDefault();

      const id =
        hit.kind === "app"
          ? hit.id
          : stepApp(roster.numbered, state.activeAppId, hit.kind === "next" ? 1 : -1);
      if (id) state.mountApp(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
