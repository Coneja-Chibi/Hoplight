/**
 * The turn runner: the imperative shell that ties the loop to the provider and the tools. On each
 * send it resolves the provider (fail-closed), builds the chat and dispatch, runs the ReAct loop, and
 * streams events to the caller. This is the ONE place live egress happens, and only when you send.
 */
import type { KitBridge } from "./bridge";
import { resolveProviderConfig } from "./providers/vault";
import { makeChat } from "./providers/chat";
import { pingProvider } from "./providers/probe";
import { discoverTools } from "./tools/discover";
import { makeDispatch, toolSpecs } from "./loop/dispatch";
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
  ): Promise<ModelMessage[]>;
  /** /test: ping the active provider once and report its greeting and latency (fail-closed). */
  probe(onEvent: (event: TurnEvent) => void): Promise<void>;
  /** The connected provider's name + model for the status bar, or null if none is set yet. */
  activeProvider(): Promise<{ name: string; model: string } | null>;
}

const MAX_STEPS = 12;

/** Build a session bound to a studio bridge. Tools are discovered once; the provider is read per turn. */
export async function createSession(bridge: KitBridge): Promise<Session> {
  const tools = await discoverTools();
  const dispatch = makeDispatch(tools, { bridge });
  const specs = toolSpecs(tools);

  return {
    async runTurn(input, history, onEvent) {
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
        const chat = makeChat(config);
        const turn = runLoop(input, history, {
          chat,
          dispatch,
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
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
        return history;
      }
    },

    async probe(onEvent) {
      try {
        const config = await resolveProviderConfig();
        if (!config) {
          onEvent({ type: "error", message: "No provider connected. Open setup with /model to add one." });
          return;
        }
        const label = `${config.name ?? config.kind} · ${config.model}`;
        onEvent({ type: "begin", label });
        const { text, ms } = await pingProvider(makeChat(config));
        onEvent({ type: "tool", name: "test", summary: `test ${label} · ${ms}ms` });
        onEvent({ type: "say", text: `"${text}"` });
      } catch (error) {
        onEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    },

    async activeProvider() {
      const config = await resolveProviderConfig();
      if (!config) return null;
      return { name: config.name ?? config.kind, model: config.model };
    },
  };
}
