/**
 * planNotifications: the pure, focus-gated decision at the heart of Notify. Given the settle event
 * (who finished + whether the terminal is focused) and the user's channel toggles, it returns the
 * ordered list of NotifyActions to fire. The whole point is focus-gating: a nudge that fires while
 * the user is watching is spam, so the heavier channels stay silent when focused and unknown focus
 * fails toward quiet (bell yes, desktop no). Pure and total: a blank label degrades to "done".
 */
import type { NotifyAction } from "./channel";

/** The user's per-channel toggles (persisted in settings; all default on, bell/desktop focus-gated). */
export interface NotifySettings {
  readonly title: boolean;
  readonly bell: boolean;
  readonly desktop: boolean;
}

/** The turn-settle moment: the "who finished" label plus terminal focus (null = unknown). */
export interface SettleEvent {
  /** The studio name shown in the title and desktop body; blank -> the "done" safe default. */
  readonly summary: string;
  /** true watching, false looked away, null unknown; unknown fails toward the quiet channel. */
  readonly focused: boolean | null;
}

/**
 * Decide what to fire. Title fires whenever enabled (cheap, always safe) and names the studio unless
 * the user is looked away (a short "done" reads better in a background tab). Bell fires when enabled
 * and the user is not known-present (unfocused or unknown -> a cheap beep is fine). Desktop fires only
 * when enabled and the user is STRICTLY unfocused (the heavier channel never fires on a guess).
 */
export const planNotifications = (event: SettleEvent, settings: NotifySettings): NotifyAction[] => {
  const label = (event.summary ?? "").trim();
  const focused = event.focused;
  const actions: NotifyAction[] = [];
  if (settings.title) {
    const text = focused === false || !label ? "done" : `done · ${label}`;
    actions.push({ channel: "title", text });
  }
  if (settings.bell && focused !== true) actions.push({ channel: "bell" });
  if (settings.desktop && focused === false) {
    actions.push({ channel: "desktop", body: label ? `Kit finished · ${label}` : "Kit finished" });
  }
  return actions;
};
