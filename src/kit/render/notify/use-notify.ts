/**
 * useNotify: the shell hook that turns a turn's busy-edge into notifications. It owns the title
 * lifecycle (push the terminal's title on mount, pop it back on unmount, per resource-lifecycle
 * doctrine), sets a "working" title on the rising edge, and on the falling edge (the settle) runs
 * planNotifications once and dispatches each action to the drop-in channel of the same name. The
 * settle plan fires exactly once per turn because it is gated on the busy true->false transition,
 * never on a re-render. Impure edge; the decision it runs (plan.ts) is pure and unit-tested.
 */
import { useEffect, useRef } from "react";
import { discoverChannels } from "./discover";
import { planNotifications, type NotifySettings } from "./plan";
import type { NotifyChannel } from "./channel";
import { restoreTitle, saveTitle, setTitle } from "./channels/title";

export interface UseNotifyArgs {
  /** The turn lifecycle flag from the shell (withTurn): true while a turn runs. */
  readonly busy: boolean;
  /** Terminal focus from useFocus; passed straight into the settle plan. */
  readonly focused: boolean;
  /** The "who finished" label for the title / desktop body (the studio name). */
  readonly studio: string;
  /** The user's channel toggles. */
  readonly settings: NotifySettings;
  /** Monotonic count of non-turn completions, such as outside studio changes. */
  readonly notice?: number;
}

export const useNotify = (args: UseNotifyArgs): void => {
  const channels = useRef<Map<string, NotifyChannel>>(new Map());
  const prevBusy = useRef(false);
  const prevNotice = useRef(args.notice ?? 0);

  // Mount: gather the drop-in channels and save the terminal title. Unmount: restore it (paired).
  useEffect(() => {
    let alive = true;
    void discoverChannels().then((found) => {
      if (alive) channels.current = new Map(found.map((c) => [c.name, c]));
    }).catch(() => {});
    if (args.settings.title) saveTitle();
    return () => {
      alive = false;
      restoreTitle();
    };
    // Mount-only: the title is saved once and restored once for the hook's lifetime.
  }, []);

  // The busy edge drives everything: rising -> "working" title, falling -> the full settle plan once.
  useEffect(() => {
    const was = prevBusy.current;
    prevBusy.current = args.busy;
    if (args.busy && !was) {
      if (args.settings.title) setTitle("working");
      return;
    }
    if (!args.busy && was) {
      const actions = planNotifications({ summary: args.studio, focused: args.focused }, args.settings);
      for (const action of actions) {
        if (action.channel === "title") setTitle(action.text);
        else channels.current.get(action.channel)?.emit(action);
      }
    }
    // Gated on the busy transition; focused/studio/settings are read at the settle render.
  }, [args.busy]);

  useEffect(() => {
    const current = args.notice ?? 0;
    const previous = prevNotice.current;
    prevNotice.current = current;
    if (current <= previous) return;
    const actions = planNotifications(
      { summary: args.studio, focused: args.focused },
      args.settings,
    );
    for (const action of actions) {
      if (action.channel === "title") setTitle(action.text);
      else channels.current.get(action.channel)?.emit(action);
    }
  }, [args.notice]);
};
