/**
 * The turn runner: the imperative shell that ties the loop to the provider and the tools. On each
 * send it resolves the provider (fail-closed), builds the chat and dispatch, runs the ReAct loop, and
 * streams events to the caller. This is the ONE place live egress happens, and only when you send.
 */
import type { KitBridge } from "./bridge";
import { resolveProviderConfig } from "./providers/vault";
import { makeChat } from "./providers/chat";
import { pingProvider, type Probe } from "./providers/probe";
import { discoverTools } from "./tools/discover";
import { makeDispatch, toolSpecs } from "./loop/dispatch";
import { makeGatedDispatch } from "./tools/safety/gated-dispatch";
import { initGate } from "./tools/safety/permission-mode";
import { runTurn as runLoop, type LoopEvent } from "./loop/loop-core";
import type { ModelMessage } from "./providers/provider";

/** What the render sees as a turn unfolds, plus a clean error path (no provider, egress blocked, API
 * failure). begin fires once when the provider resolves (who is about to answer); delta streams live
 * typing/thinking fragments while the reply forms. */
export type TurnEvent =
  | LoopEvent
  | { type: "begin"; label: string }
  | { type: "delta"; kind: "text" | "reasoning"; text: string }
  | { type: "error"; message: string };

export interface Session {
  runTurn(
    input: string,
    history: ModelMessage[],
    onEvent: (event: TurnEvent) => void,
    signal?: AbortSignal,
  ): Promise<ModelMessage[]>;
  /** /test: ping the active provider once and report its greeting and latency (fail-closed). */
  probe(onEvent: (event: TurnEvent) => void, signal?: AbortSignal): Promise<void>;
  /** Doctor's provider row: the same real ping as /test, returned as structured read-only data. */
  providerProbe?(signal?: AbortSignal): Promise<(Probe & { name: string; model: string }) | null>;
  /** The connected provider's name + model for the status bar, or null if none is set yet. */
  activeProvider(): Promise<{ name: string; model: string; context?: number } | null>;
}

const MAX_STEPS = 12;

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
export async function createSession(bridge: KitBridge): Promise<Session> {
  const tools = await discoverTools();
  const dispatch = makeDispatch(tools, { bridge });
  const specs = toolSpecs(tools);

  return {
    async runTurn(input, history, onEvent, signal) {
      try {
        const config = await resolveProviderConfig();
        if (!config) {
          onEvent({
            type: "error",
            message: "No provider connected. Open setup with /model to add one.",
          });
          return history;
        }
        onEvent({ type: "begin", label: `${config.name ?? config.kind} · ${config.model}` });
        const chat = makeChat(config, signal);
        // Every tool call rides through the safety gate (built per turn so its abort-latch is the turn's
        // memory). Fail-closed by default: the read tools classify "safe" and pass; anything risky would
        // hit confirm, and with no confirm seam wired yet it is blocked. When the /gates screen and the
        // confirm prompt land, the shell threads the live mode + requestConfirm through here.
        const gated = makeGatedDispatch(dispatch, { state: initGate() });
        const turn = runLoop(input, history, {
          chat,
          dispatch: gated,
          tools: specs,
          maxSteps: MAX_STEPS,
          onDelta: (delta) => onEvent({ type: "delta", kind: delta.kind, text: delta.text }),
        });
        let next = await turn.next();
        while (!next.done) {
          onEvent(next.value);
          next = await turn.next();
        }
        return next.value;
      } catch (error) {
        if (signal?.aborted) {
          onEvent({ type: "stopped", reason: "Turn cancelled." });
          return history;
        }
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
        return history;
      }
    },

    async probe(onEvent, signal) {
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
        if (signal?.aborted) {
          onEvent({ type: "stopped", reason: "Provider test cancelled." });
          return;
        }
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    },

    async providerProbe(signal) {
      const config = await resolveProviderConfig();
      if (!config) return null;
      const result = await pingProvider(makeChat(config, signal));
      return {
        ...result,
        name: config.name ?? config.kind,
        model: config.model,
      };
    },

    async activeProvider() {
      const config = await resolveProviderConfig();
      if (!config) return null;
      return {
        name: config.name ?? config.kind,
        model: config.model,
        ...(config.context ? { context: config.context } : {}),
      };
    },
  };
}
