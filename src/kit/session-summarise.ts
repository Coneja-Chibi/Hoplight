/**
 * One model call that reads a conversation and writes prose about it.
 *
 * ITS OWN SEAM, AND NO TOOLS. A compaction pass is housekeeping - it runs because a conversation
 * got long, not because anybody asked for anything - so it must not be able to DO anything. Given
 * the belt it would be a turn like any other, and a tidy-up that could call studio_delete while
 * summarising is a write nobody asked for, made by a step nobody was watching.
 *
 * NULL RATHER THAN THROWING, because the caller is about to run a turn either way. Losing the
 * detail in old messages is bad; refusing to answer because housekeeping failed is worse.
 */
import { makeChat } from "./providers/chat";
import { pingProvider } from "./providers/probe";
import { resolveProviderConfig } from "./providers/vault";
import type { ModelMessage } from "./providers/provider";

/** The events a probe reports. Structurally the subset of TurnEvent it uses, so no import cycle. */
type ProbeEvent =
  | { type: "begin"; label: string }
  | { type: "tool"; name: string; summary: string }
  | { type: "say"; text: string }
  | { type: "stopped"; reason: string }
  | { type: "error"; message: string };

export async function summariseMessages(
  messages: readonly ModelMessage[],
  instruction: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const config = await resolveProviderConfig();
    if (!config) return null;
    // No tool list and no ambient context: this call reads a conversation and answers in words.
    const chat = makeChat(config, signal);
    const reply = await chat([...messages, { role: "user", content: instruction }], []);
    // A reply that reached for tools is not a summary; treat it as a failed pass.
    return reply.kind === "say" && reply.text.trim() ? reply.text : null;
  } catch {
    return null;
  }
}

/**
 * `/test`: ping the active provider once and report its greeting and latency.
 *
 * Beside summarise because it is the same shape - one bounded call that reaches the provider and
 * nothing else, with no tools and no studio access - and session.ts is at its cap for the ordinary
 * reason that the turn runner is the thing that belongs there.
 */
export async function probeProvider(
  onEvent: (event: ProbeEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const config = await resolveProviderConfig();
    if (!config) {
      onEvent({ type: "error", message: "No provider connected. Open setup with /model to add one." });
      return;
    }
    const label = `${config.name ?? config.kind} · ${config.model}`;
    onEvent({ type: "begin", label });
    const { text, ms } = await pingProvider(makeChat(config, signal));
    onEvent({ type: "tool", name: "test", summary: `test ${label} · ${ms}ms` });
    onEvent({ type: "say", text: `"${text}"` });
  } catch (error) {
    // A cancel is something somebody chose, not a failure to report as one.
    if (signal?.aborted) {
      onEvent({ type: "stopped", reason: "Provider test cancelled." });
      return;
    }
    onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}
