/**
 * The Notify channel contract and action union: types only, the seam between the pure decision core
 * (plan.ts) and the impure escape-code emitters (channels/*.ts). planNotifications yields NotifyActions;
 * discover.ts gathers drop-in NotifyChannels; use-notify.ts dispatches each action to the channel of
 * the same name. A new channel is a new file under channels/ that default-exports a NotifyChannel,
 * nothing central to edit (folders-as-schema, mirroring commands/). No runtime code here.
 */

/** One thing to do on a settle: sync the title, ring the bell, or fire a desktop nudge. */
export type NotifyAction =
  | { readonly channel: "title"; readonly text: string }
  | { readonly channel: "bell" }
  | { readonly channel: "desktop"; readonly body: string };

/** A drop-in emitter for one channel; emit handles only the action whose channel matches its name. */
export interface NotifyChannel {
  /** "title" | "bell" | "desktop": the action.channel this emitter answers to. */
  readonly name: string;
  emit(action: NotifyAction): void;
}
